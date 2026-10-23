import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,type Mutation} from '@tanstack/react-query';
import {UpdatesSettings} from '../../src/components/UpdatesSettings';
const controls=window as unknown as {renderUpdates:(dirty?:boolean,busy?:boolean,mutating?:boolean)=>void};
const client=new QueryClient();
const root=createRoot(document.getElementById('root')!);
let mutation:Mutation<unknown,Error,void,unknown>|undefined;
controls.renderUpdates=(dirty=false,busy=false,mutating=false)=>{
 if(mutating){mutation=client.getMutationCache().build(client,{mutationFn:()=>new Promise(()=>{})});void mutation.execute();}
 else if(mutation){client.getMutationCache().remove(mutation);mutation=undefined;}
 root.render(<QueryClientProvider client={client}><input id="background-input" aria-label="Workspace record" defaultValue="saved"/><UpdatesSettings hasUnsavedChanges={dirty} workspaceBusy={busy}/></QueryClientProvider>);
};
controls.renderUpdates();
