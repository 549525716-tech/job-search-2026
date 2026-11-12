import json,re,csv,difflib,collections
L=json.load(open('liepin-2026-11-02-full-list.json'));B=json.load(open('boss-2026-11-02-full-list.json'));B1=json.load(open('liepin-2026-11-02-batch1.json'))
b1={x['url']:x for x in B1 if 'url' in x}
def sal(s):
    if not s: return None,None,''
    m=re.match(r'\s*(\d*)\s*-\s*(\d+)\s*[kK]',s)
    if not m: return None,None,s
    lo=int(m.group(1)) if m.group(1) else None; hi=int(m.group(2))
    if hi>=100: return (round(lo/12,1) if lo else None),round(hi/12,1),s+'(年薪,已÷12)'
    return lo,hi,s
GD=re.compile(r'广州|深圳|东莞|佛山|珠海|惠州|中山|江门|肇庆|汕头|湛江|广东')
def direction(t):
    if re.search(r'运营|策略|销售支持|商业分析|SOP|销管|销售管理(?!.*经理)',t): 
        if re.search(r'销管|销售管理',t) and not re.search(r'运营',t): return '销售管理'
        return '销售及商业运营'
    if re.search(r'总监|大区|区域经理|城市经理|负责人|主管|团队|店长|总经理|战区',t) and re.search(r'销售|零售|区域|大区|战区|店长|城市',t): return '销售管理'
    if re.search(r'渠道|BD|商务|生态|合作|拓展|招商|加盟|Partner',t,re.I): return '商务渠道生态'
    if re.search(r'市场|营销|品牌|推广|Marketing|增长',t,re.I) and not re.search(r'销售',t): return '市场营销'
    return '销售/KA'
def act(u):
    if not u: return '活跃未知',None
    if '当前在线' in u or '刚刚' in u or '分钟' in u: return '易沟通(24h内在线)',0
    m=re.match(r'(\d+)小时前',u)
    if m: return '易沟通(24h内在线)',int(m.group(1))
    m=re.match(r'(\d+)天前',u)
    if m: return '非24h在线',int(m.group(1))*24
    return '非24h在线',None
recs=[]
for x in L:
    lo,hi,raw=sal(x['sal']); d=b1.get(x['url'])
    recs.append(dict(平台='猎聘',岗位=x['t'],公司=x['c'],行业=x.get('ind'),城市=x['city'],薪资原文=raw,薪资下限K=lo,薪资上限K=hi,经验=x.get('exp'),学历=x.get('edu'),URL=x['url'],发布者=x.get('pub'),发布者类型=x.get('pub_type'),招聘者活跃=x.get('updated'),命中关键词=x.get('kw'),完整JD=(d or {}).get('jd')))
for x in B:
    lo,hi,raw=sal(x['薪资'])
    recs.append(dict(平台='BOSS直聘',岗位=x['岗位名'],公司=x['公司'],行业=x.get('行业规模'),城市=x['城市区域'],薪资原文=raw,薪资下限K=lo,薪资上限K=hi,经验=x.get('经验'),学历=x.get('学历'),URL=x['URL'],发布者=None,发布者类型=None,招聘者活跃=None,命中关键词='、'.join(x.get('命中关键词') or []),完整JD=None))
urls={r['URL'] for r in recs}
for x in B1:
    if 'url' in x and x['url'] not in urls:
        lo,hi,raw=sal(x['salary']); ee=(x.get('experience_education') or '').split(' / ')
        recs.append(dict(平台='猎聘',岗位=x['title'],公司=x['company'],行业=None,城市=x['city'],薪资原文=raw,薪资下限K=lo,薪资上限K=hi,经验=ee[0],学历=ee[-1],URL=x['url'],发布者=x.get('recruiter'),发布者类型='猎头' if '猎头' in (x.get('recruiter') or '') else 'HR',招聘者活跃=(re.search(r'（([^，）]*在线)',x.get('recruiter') or '') or [None,None])[1] or x.get('updated'),命中关键词='首页推荐(batch1)',完整JD=x.get('jd')))
n_raw=len(recs)
# same-URL dedup
seen={};u=[]
for r in recs:
    if r['URL'] in seen: continue
    seen[r['URL']]=1;u.append(r)
n_url=len(u)
def nc(c): return re.sub(r'[（(].*?[)）]|股份|有限|责任|公司|集团|科技|信息|技术|网络|中国|（.*|\s','',c or '')
def nt(t): return re.sub(r'[（(【\[].*?[)）】\]]|[\s\-—_/·|]','',t or '')
groups=[]
for r in u:
    hit=None
    if not (r['公司'] or '').startswith('某'):
        for g in groups:
            h=g[0]
            if nc(h['公司']) and nc(h['公司'])==nc(r['公司']) and difflib.SequenceMatcher(None,nt(h['岗位']),nt(r['岗位'])).ratio()>=0.75 and h['城市'][:2]==r['城市'][:2]:
                hit=g;break
    if hit: hit.append(r)
    else: groups.append([r])
HIGH=60
out=[]
for g in groups:
    p=sorted(g,key=lambda r:(r['平台']!='猎聘'))[0].copy()
    plats=sorted(set(r['平台'] for r in g))
    p['平台标注']='双平台' if len(plats)>1 else plats[0]
    p['同岗记录数']=len(g); p['其他URL']=[r['URL'] for r in g if r['URL']!=p['URL']]
    if p['平台']=='猎聘' and len(plats)>1:
        bs=[r for r in g if r['平台']!='猎聘'][0]
    lo,hi=p['薪资下限K'],p['薪资上限K']
    flag=[]
    if p['平台']=='BOSS直聘' or any(r['平台']=='BOSS直聘' for r in g):
        for r in g:
            if r['平台']=='BOSS直聘' and (r['薪资下限K'] is None or (r['薪资下限K']<=10 and r['薪资上限K'] and r['薪资上限K']>=2*r['薪资下限K'])): flag.append('薪资待核')
    if hi is None: flag.append('薪资待核')
    p['薪资标注']='薪资待核' if flag else ''
    t=p['岗位'];d=direction(t);p['方向分类']=d
    txt=t+(p['公司'] or '')+(p['行业'] or '')+(p['完整JD'] or '')
    s={'销售管理':30,'销售/KA':28,'销售及商业运营':26,'商务渠道生态':24,'市场营销':20}[d]; why=[d]
    if re.search(r'汽车|整车|车企|主机厂|二手车|乘用车|新能源车|4S|充电|特斯拉|懂车帝|电动车',t+(p['公司'] or '')+(p['行业'] or '')): s+=25; why.append('汽车行业(特斯拉/乐道/字节跳动-懂车帝)')
    elif re.search(r'互联网|广告|信息流|本地生活|平台|电商|抖音|字节|商业化',txt): s+=15; why.append('互联网/广告商业化(字节跳动-懂车帝)')
    if re.search(r'AI|人工智能|大模型',txt,re.I): s+=5; why.append('AI')
    if re.search(r'大客户|KA',t,re.I): s+=5; why.append('大客户经验')
    if hi: s+= 15 if hi>=50 else 10 if hi>=35 else 5 if hi>=20 else 0
    if GD.search(p['城市'] or ''): s+=10; why.append('广东')
    e=p['学历'] or ''
    if '统招' in e: s-=10; why.append('要求统招本科(本人专科)')
    elif '本科' in e or '硕士' in e: s-=5; why.append('要求本科(本人专科)')
    if re.search(r'10年',p['经验'] or ''): s-=10; why.append('要求10年以上')
    if re.search(r'总监|总经理|VP|大区总',t) and d=='销售管理': s-=5; why.append('总监级需多店/大区管理')
    if d=='销售管理' and re.search(r'汽车|整车|车企|特斯拉',txt): why.append('乐道店长直管10人；特斯拉段无直管下属')
    p['匹配分']=max(0,min(100,s)); p['匹配依据']='；'.join(why)
    a,h=act(p['招聘者活跃']) if p['平台']=='猎聘' else ('活跃未知',None)
    p['招聘者活跃分类']=a
    if '1986214661' in p['URL'] or any('1986214661' in x for x in p['其他URL']): st='已沟通(页面显示继续聊)'
    elif a.startswith('易沟通') : st='易沟通'
    elif p['匹配分']>=HIGH: st='待沟通'
    else: st='未分级'
    p['沟通状态']=st; p['跟进情况']='投递跟踪表暂无记录'
    p['抓取时间']='2026-11-02 (UTC+8)'; p['广东']=bool(GD.search(p['城市'] or ''))
    p['进入机会池']= bool(hi and hi>=20)
    out.append(p)
out.sort(key=lambda r:-r['匹配分'])
json.dump(dict(meta=dict(生成='2026-11-02 UTC+8',原始记录=n_raw,URL去重后=n_url,跨平台去重后=len(out),高分阈值=HIGH,打分说明='规则分(方向+行业匹配+大客户+薪资上限+广东-学历/年限门槛)，非正式能力评分；本人学历专科',局限='仅广州/深圳每关键词第1页；BOSS缺招聘者与行业字段；跟踪表为空'),jobs=out),open('platform-jobs-merged-2026-11-02.json','w'),ensure_ascii=False,indent=1)
cols=['平台标注','岗位','公司','城市','薪资下限K','薪资上限K','薪资原文','薪资标注','经验','学历','URL','发布者','发布者类型','招聘者活跃','招聘者活跃分类','方向分类','匹配分','匹配依据','沟通状态','跟进情况','抓取时间','同岗记录数','行业']
with open('platform-jobs-merged-2026-11-02.csv','w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,cols,extrasaction='ignore');w.writeheader();w.writerows(out)
C=collections.Counter
print(n_raw,n_url,len(out),C(r['平台标注'] for r in out))
print(C(r['方向分类'] for r in out));print(C(r['沟通状态'] for r in out));print(C(r['薪资标注'] for r in out))
print('GD',sum(r['广东'] for r in out),'pool',sum(r['进入机会池'] for r in out),'high',sum(r['匹配分']>=HIGH for r in out))
print(C(r['匹配分']//10*10 for r in out))
for r in out[:15]: print(r['匹配分'],r['平台标注'],r['公司'],r['岗位'],r['薪资原文'],r['城市'],r['沟通状态'])
for r in out:
  if r['平台标注']=='双平台': print('DUP',r['公司'],r['岗位'])
