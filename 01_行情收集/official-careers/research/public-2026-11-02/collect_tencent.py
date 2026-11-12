import json,subprocess,hashlib,time,urllib.parse,datetime,re,os
OUT='raw';log=open('web-session.jsonl','a')
last=[0]
def get(url,tag):
    w=max(0,12.5-(time.time()-last[0]));time.sleep(w)
    t0=datetime.datetime.now(datetime.timezone.utc).isoformat()
    r=subprocess.run(['curl','-sS','-m','30','-A','OfficialCareersEvidence/0.1',url],capture_output=True)
    last[0]=time.time();body=r.stdout;sha=hashlib.sha256(body).hexdigest()
    p=f'{OUT}/{tag}.json';open(p,'wb').write(body)
    log.write(json.dumps({'url':url,'started_at':t0,'curl_exit':r.returncode,'bytes':len(body),'sha256':sha,'body_path':p},ensure_ascii=False)+'\n');log.flush()
    return body,p,sha,t0
posts={}
for i,kw in enumerate(['销售','市场','渠道','商务','生态','售前','解决方案','销售运营','商业化']):
    page=1
    while True:
        u='https://careers.tencent.com/tencentcareer/api/post/Query?timestamp=1&keyword='+urllib.parse.quote(kw)+f'&pageIndex={page}&pageSize=100&language=zh-cn&area=cn'
        b,p,s,t=get(u,f'q{i}-p{page}')
        try:d=json.loads(b)['Data']
        except Exception as e: print('ERR',kw,e);break
        for x in d['Posts'] or []: posts.setdefault(x['PostId'],{'list':x,'kw':[]})['kw'].append(kw)
        print(kw,page,d['Count'],len(d['Posts'] or []),flush=True)
        if page*100>=d['Count'] or not d['Posts']:break
        page+=1
json.dump(posts,open('tencent-list.json','w'),ensure_ascii=False)
ex=re.compile('产品经理|客户成功|实习|算法|研发|工程师|开发|设计师|校招')
inc=re.compile('销售|市场|营销|渠道|商务|生态|售前|解决方案|BD|KA|大客户|商业化|运营|GTM|Sales|Marketing|Partner',re.I)
keep=[k for k,v in posts.items() if inc.search(v['list']['RecruitPostName']) and not ex.search(v['list']['RecruitPostName']) and v['list']['CountryName']=='中国']
print('keep',len(keep),'of',len(posts),flush=True)
for n,pid in enumerate(keep):
    b,p,s,t=get(f'https://careers.tencent.com/tencentcareer/api/post/ByPostId?timestamp=1&postId={pid}&language=zh-cn',f'd-{pid}')
    posts[pid]['detail']={'path':p,'sha256':s,'fetched_at':t}
    json.dump(posts,open('tencent-list.json','w'),ensure_ascii=False)
print('done')
