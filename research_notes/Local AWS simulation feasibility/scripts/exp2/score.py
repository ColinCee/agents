import json,sys
c=json.load(open("cases.json"));r=json.load(open("ruler_out.json"))["matchesRule"]
for name in sys.argv[1:]:
    o=json.load(open(name));bad=[]
    for x in c:
        gt=r[x["id"]];v=o.get(x["id"],"missing")
        if v!=gt: bad.append((x["id"],x["desc"],"ruler="+gt,name.split('_')[0]+"="+v))
    print(f"{name}: {len(c)-len(bad)}/{len(c)} agree with event-ruler")
    for b in bad: print("  ",*b)
