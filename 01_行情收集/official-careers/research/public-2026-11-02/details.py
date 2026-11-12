exec(open('collect_tencent.py').read().split('posts={}')[0])
posts=json.load(open('tencent-list.json'))
for pid in json.load(open('detail-queue.json')):
    if 'detail' in posts[pid]: continue
    b,p,s,t=get(f'https://careers.tencent.com/tencentcareer/api/post/ByPostId?timestamp=1&postId={pid}&language=zh-cn',f'd-{pid}')
    posts[pid]['detail']={'path':p,'sha256':s,'fetched_at':t}
    json.dump(posts,open('tencent-list.json','w'),ensure_ascii=False)
print('done',flush=True)
