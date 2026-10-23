use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockAdjustmentInput {
    pub id: String,
    pub product_id: String,
    pub quantity_delta_scaled: i64,
    pub business_date: String,
    pub reason: String,
    pub reversal_of: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StockMovement {
    pub id: String,
    pub product_id: String,
    pub reference_type: String,
    pub reference_id: Option<String>,
    pub quantity_delta_scaled: i64,
    pub resulting_stock_scaled: i64,
    pub notes: Option<String>,
    pub created_at: i64,
}
fn movement(row: &rusqlite::Row<'_>) -> rusqlite::Result<StockMovement> {
    Ok(StockMovement { id:row.get(0)?, product_id:row.get(1)?, reference_type:row.get(2)?, reference_id:row.get(3)?, quantity_delta_scaled:row.get(4)?, resulting_stock_scaled:row.get(5)?, notes:row.get(6)?, created_at:row.get(7)? })
}
fn find_movement(conn: &Connection, id: &str) -> Result<Option<StockMovement>,String> {
    conn.query_row("SELECT id,product_id,reference_type,reference_id,quantity_delta_scaled,resulting_stock_scaled,notes,created_at FROM stock_movements WHERE id=?1",[id],movement).optional().map_err(|e|e.to_string())
}
pub fn get_stock_history(conn: &Connection, product_id: &str) -> Result<Vec<StockMovement>,String> {
    let exists:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM products WHERE id=?1)",[product_id],|r|r.get(0)).map_err(|e|e.to_string())?;
    if !exists {return Err("Product not found".into());}
    let mut stmt=conn.prepare("SELECT id,product_id,reference_type,reference_id,quantity_delta_scaled,resulting_stock_scaled,notes,created_at FROM stock_movements WHERE product_id=?1 ORDER BY created_at DESC,id DESC").map_err(|e|e.to_string())?;
    let rows=stmt.query_map([product_id],movement).map_err(|e|e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e|e.to_string())
}
pub fn post_stock_adjustment(conn: &mut Connection, mut input:StockAdjustmentInput) -> Result<StockMovement,String> {
    let parsed_id=uuid::Uuid::parse_str(&input.id).map_err(|_|"Adjustment ID must be a UUID")?;
    if parsed_id.hyphenated().to_string()!=input.id.to_lowercase() {return Err("Adjustment ID must be a hyphenated UUID".into());}
    input.reversal_of=input.reversal_of.map(|s|s.trim().to_string()).filter(|s|!s.is_empty());
    input.reason=input.reason.trim().to_string();
    if input.reason.is_empty() || input.reason.chars().count()>500 {return Err("Reason is required and must not exceed 500 characters".into());}
    let date=chrono::NaiveDate::parse_from_str(&input.business_date,"%Y-%m-%d").map_err(|_|"Invalid business date")?;
    if date.format("%Y-%m-%d").to_string()!=input.business_date {return Err("Invalid business date".into());}
    if input.quantity_delta_scaled==0 || input.quantity_delta_scaled < -crate::domain::financial::MAX_QUANTITY_SCALED || input.quantity_delta_scaled > crate::domain::financial::MAX_QUANTITY_SCALED {return Err("Adjustment quantity is outside supported bounds".into());}
    let notes=serde_json::json!({"business_date":input.business_date,"reason":input.reason}).to_string();
    let tx=conn.transaction().map_err(|e|e.to_string())?;
    if let Some(existing)=find_movement(&tx,&input.id)? {
        let same_notes=existing.notes.as_ref().and_then(|n|serde_json::from_str::<serde_json::Value>(n).ok())==serde_json::from_str::<serde_json::Value>(&notes).ok();
        if existing.reference_type=="adjustment" && existing.product_id==input.product_id && existing.reference_id==input.reversal_of && existing.quantity_delta_scaled==input.quantity_delta_scaled && same_notes {return Ok(existing);}
        return Err("Adjustment ID already exists with a different intent".into());
    }
    let product:Option<(bool,bool,i64)>=tx.query_row("SELECT is_active,is_stock_tracked,current_stock_scaled FROM products WHERE id=?1",[&input.product_id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(|e|e.to_string())?;
    let (active,tracked,current)=product.ok_or("Product not found")?;
    if !active || !tracked {return Err("Stock adjustments require an active tracked product".into());}
    let sum:i64=tx.query_row("SELECT COALESCE(SUM(quantity_delta_scaled),0) FROM stock_movements WHERE product_id=?1",[&input.product_id],|r|r.get(0)).map_err(|e|e.to_string())?;
    if sum!=current {return Err("Stock ledger does not match product stock".into());}
    if let Some(ref original_id)=input.reversal_of {
        let original=find_movement(&tx,original_id)?.ok_or("Original adjustment not found")?;
        if original.reference_type!="adjustment" || original.reference_id.is_some() || original.product_id!=input.product_id || original.quantity_delta_scaled.checked_neg()!=Some(input.quantity_delta_scaled) {return Err("Correction must oppose an original adjustment for this product".into());}
        let corrected:bool=tx.query_row("SELECT EXISTS(SELECT 1 FROM stock_movements WHERE reference_type='adjustment' AND reference_id=?1)",[original_id],|r|r.get(0)).map_err(|e|e.to_string())?;
        if corrected {return Err("Adjustment already corrected".into());}
    }
    let resulting=current.checked_add(input.quantity_delta_scaled).ok_or("Stock quantity overflow")?;
    if !(0..=crate::domain::financial::MAX_QUANTITY_SCALED).contains(&resulting) {return Err("Resulting stock is outside supported bounds".into());}
    let now=chrono::Utc::now().timestamp_millis();
    tx.execute("INSERT INTO stock_movements(id,product_id,reference_type,reference_id,quantity_delta_scaled,resulting_stock_scaled,notes,created_at) VALUES(?1,?2,'adjustment',?3,?4,?5,?6,?7)",params![input.id,input.product_id,input.reversal_of,input.quantity_delta_scaled,resulting,notes,now]).map_err(|e|e.to_string())?;
    tx.execute("UPDATE products SET current_stock_scaled=?1,updated_at=?2 WHERE id=?3",params![resulting,now,input.product_id]).map_err(|e|e.to_string())?;
    let result=find_movement(&tx,&input.id)?.ok_or("Adjustment missing after insertion")?;
    tx.commit().map_err(|e|e.to_string())?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        super::super::configure_connection(&c).unwrap();
        super::super::run_migrations(&mut c).unwrap();
        c.execute("INSERT INTO products(id,sku,name,unit,unit_price_minor,is_stock_tracked,current_stock_scaled,is_active,created_at,updated_at) VALUES('p','P','Product','unit',100,1,0,1,0,0)", []).unwrap();
        c
    }
    fn input(delta: i64) -> StockAdjustmentInput {
        StockAdjustmentInput { id: uuid::Uuid::new_v4().to_string(), product_id:"p".into(), quantity_delta_scaled:delta, business_date:"2026-10-23".into(), reason:" Counted stock ".into(), reversal_of:None }
    }
    #[test]
    fn stock_adjustment_retry_correction_and_archived_history() {
        let mut c=setup(); let i=input(5000);
        let m=post_stock_adjustment(&mut c,i.clone()).unwrap();
        assert_eq!(m.resulting_stock_scaled,5000);
        assert_eq!(serde_json::from_str::<serde_json::Value>(m.notes.as_ref().unwrap()).unwrap()["reason"],"Counted stock");
        assert_eq!(post_stock_adjustment(&mut c,i.clone()).unwrap(),m);
        let mut conflict=i.clone(); conflict.quantity_delta_scaled=1000;
        assert!(post_stock_adjustment(&mut c,conflict).is_err());
        let mut correction=input(-5000); correction.reversal_of=Some(m.id.clone());
        let corrected=post_stock_adjustment(&mut c,correction.clone()).unwrap();
        assert_eq!(corrected.resulting_stock_scaled,0);
        assert_eq!(post_stock_adjustment(&mut c,correction.clone()).unwrap(),corrected);
        correction.id=uuid::Uuid::new_v4().to_string();
        assert!(post_stock_adjustment(&mut c,correction).is_err());
        let mut second=input(5000);second.reversal_of=Some(corrected.id);
        assert!(post_stock_adjustment(&mut c,second).is_err());
        c.execute("UPDATE products SET is_active=0",[]).unwrap();
        assert_eq!(post_stock_adjustment(&mut c,i).unwrap(),m);
        assert!(post_stock_adjustment(&mut c,input(1000)).is_err());
        assert_eq!(get_stock_history(&c,"p").unwrap().len(),2);
        assert!(get_stock_history(&c,"missing").is_err());
    }
    #[test]
    fn stock_adjustment_validation_and_atomic_rollback() {
        let mut c=setup();
        for delta in [0,-1,i64::MAX,crate::domain::financial::MAX_QUANTITY_SCALED+1] { assert!(post_stock_adjustment(&mut c,input(delta)).is_err()); }
        for (date,reason,id) in [("2026-02-30","reason",uuid::Uuid::new_v4().to_string()),("2026-10-23","  ",uuid::Uuid::new_v4().to_string()),("2026-10-23","reason","bad".into())] {
            let mut i=input(1);i.business_date=date.into();i.reason=reason.into();i.id=id; assert!(post_stock_adjustment(&mut c,i).is_err());
        }
        c.execute_batch("CREATE TRIGGER fail_stock_update BEFORE UPDATE OF current_stock_scaled ON products BEGIN SELECT RAISE(ABORT,'injected'); END;").unwrap();
        assert!(post_stock_adjustment(&mut c,input(1000)).is_err());
        assert_eq!(get_stock_history(&c,"p").unwrap().len(),0);
        assert_eq!(c.query_row("SELECT current_stock_scaled FROM products WHERE id='p'",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        c.execute_batch("DROP TRIGGER fail_stock_update; UPDATE products SET current_stock_scaled=1;").unwrap();
        assert!(post_stock_adjustment(&mut c,input(1000)).is_err());
        c.execute_batch("UPDATE products SET current_stock_scaled=0,is_stock_tracked=0;").unwrap();
        assert!(post_stock_adjustment(&mut c,input(1000)).is_err());
    }
    #[test]
    fn stock_adjustment_ledger_identity_bounds_and_correction_guards() {
        let mut c=setup();
        let max=crate::domain::financial::MAX_QUANTITY_SCALED;
        let first=post_stock_adjustment(&mut c,input(max)).unwrap();
        assert!(post_stock_adjustment(&mut c,input(1)).is_err());
        let mut wrong=input(-1);wrong.reversal_of=Some(first.id.clone());
        assert!(post_stock_adjustment(&mut c,wrong).is_err());
        let mut blank=input(-1);blank.reason="a".repeat(501);
        assert!(post_stock_adjustment(&mut c,blank).is_err());
        let mut wrong_product=input(-max);wrong_product.product_id="other".into();wrong_product.reversal_of=Some(first.id.clone());
        c.execute("INSERT INTO products(id,sku,name,unit,unit_price_minor,is_stock_tracked,current_stock_scaled,is_active,created_at,updated_at) VALUES('other','OTHER','Other','unit',100,1,0,1,0,0)", []).unwrap();
        assert!(post_stock_adjustment(&mut c,wrong_product).is_err());
        let reused=input(1);
        c.execute("INSERT INTO stock_movements(id,product_id,reference_type,quantity_delta_scaled,resulting_stock_scaled,created_at) VALUES(?1,'other','opening',1,1,0)",[&reused.id]).unwrap();
        assert!(post_stock_adjustment(&mut c,reused).is_err());
        let second=post_stock_adjustment(&mut c,input(-1000)).unwrap();
        c.execute("UPDATE stock_movements SET created_at=10 WHERE product_id='p'",[]).unwrap();
        let history=get_stock_history(&c,"p").unwrap();
        assert_eq!(history.len(),2);
        assert!(history[0].id>history[1].id);
        assert_eq!(history.iter().map(|m|m.quantity_delta_scaled).sum::<i64>(),max-1000);
        assert_ne!(first.id,second.id);
    }

    #[test]
    fn stock_adjustment_backup_roundtrip_and_smallest_fraction() {
        let mut c=setup();
        let first=post_stock_adjustment(&mut c,input(1)).unwrap();
        assert_eq!(first.resulting_stock_scaled,1);
        let mut correction=input(-1);correction.reversal_of=Some(first.id);
        post_stock_adjustment(&mut c,correction.clone()).unwrap();
        let expected=get_stock_history(&c,"p").unwrap();
        let backup=super::super::backup::create_workspace_backup(&c).unwrap();
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("active.db");
        drop(super::super::initialize_database(&path).unwrap());
        super::super::backup::restore_workspace_backup(&path,&backup).unwrap();
        let mut restored=super::super::initialize_database(&path).unwrap();
        assert_eq!(get_stock_history(&restored,"p").unwrap(),expected);
        assert_eq!(post_stock_adjustment(&mut restored,correction).unwrap().resulting_stock_scaled,0);
        assert_eq!(restored.query_row("SELECT COUNT(*) FROM cashbook_movements",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    }

}
