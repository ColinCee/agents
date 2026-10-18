import {runSimulation} from '@cloud-copilot/iam-simulate'
import fs from 'node:fs'
const cases=JSON.parse(fs.readFileSync(process.argv[2],'utf8'))
const act={send:'sqs:SendMessage',delete:'sqs:DeleteQueue',purge:'sqs:PurgeQueue'}
let ok=0
for(const c of cases){
  const sim={request:{principal:'arn:aws:iam::123456789012:user/u',action:act[c.op],resource:{resource:`arn:aws:sqs:us-east-1:123456789012:${c.queue}`,accountId:'123456789012'},contextVariables:{'aws:RequestedRegion':'us-east-1'}},
    identityPolicies:[{name:'p',policy:c.policy}],serviceControlPolicies:[],resourceControlPolicies:[]}
  let r;try{r=await runSimulation(sim,{})}catch(e){r={result:'ERR '+String(e.message).slice(0,80)}}
  const allowed=r.overallResult==='Allowed'
  const good=allowed===c.expected; if(good)ok++
  console.log((good?'OK  ':'MISMATCH ')+`expected_allowed=${c.expected} got=${r.overallResult} :: ${c.desc}`)
}
console.log(`${ok}/${cases.length} match documented semantics`)
