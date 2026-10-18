import json,time
from moto.events.models import EventPattern, EventPatternParser
pat={"source":["app1"],"detail-type":["order.paid"],"detail":{"region":["us-1"],"amount":[{"numeric":[">",10]}],"ip":[{"cidr":"10.1.0.0/16"}]}}
p=EventPattern(json.dumps(pat),EventPatternParser(json.dumps(pat)).parse())
ev={"source":"app1","detail-type":"order.paid","detail":{"region":"us-1","amount":50,"ip":"10.1.2.3","pad":"x"*40}}
print(p.matches_event(ev))
N=20000;t=time.perf_counter()
for _ in range(N):p.matches_event(ev)
d=time.perf_counter()-t;print(f"moto single-rule match: {N/d:.0f} events/sec (1 rule, matching event)")
