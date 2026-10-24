import {invoke} from '@tauri-apps/api/core';
import {isTauriEnvironment} from './tauri';
import type {CreateDraftInvoiceRequest,UpdateDraftInvoiceRequest,InvoiceDraftDetailDto,InvoiceDraftSummaryDto} from '../types/invoice_drafts';
export async function createInvoiceDraft(request:CreateDraftInvoiceRequest):Promise<InvoiceDraftDetailDto>{return isTauriEnvironment()?invoke('create_invoice_draft',{request}):(await import('./web_invoice_drafts')).createWebDraft(request);}
export async function updateInvoiceDraft(request:UpdateDraftInvoiceRequest):Promise<InvoiceDraftDetailDto>{return isTauriEnvironment()?invoke('update_invoice_draft',{request}):(await import('./web_invoice_drafts')).updateWebDraft(request);}
export async function getInvoiceDraft(id:string):Promise<InvoiceDraftDetailDto>{return isTauriEnvironment()?invoke('get_invoice_draft',{id}):(await import('./web_invoice_drafts')).getWebDraft(id);}
export async function listInvoiceDrafts():Promise<InvoiceDraftSummaryDto[]>{return isTauriEnvironment()?invoke('list_invoice_drafts'):(await import('./web_invoice_drafts')).listWebDrafts();}
export async function deleteInvoiceDraft(id:string,expected_version:number):Promise<void>{return isTauriEnvironment()?invoke('delete_invoice_draft',{id,expectedVersion:expected_version}):(await import('./web_invoice_drafts')).deleteWebDraft(id,expected_version);}
