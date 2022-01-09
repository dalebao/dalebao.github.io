[postgres 正则匹配](evernote:///view/32713371/s44/5c8aacb5-c3ff-4d2a-8aa9-d7cad280a093/5c8aacb5-c3ff-4d2a-8aa9-d7cad280a093/)查看 postgres 当前连接数

select count(\*), usename from pg\_stat\_activity group by usename;

按照日期生成

select day::date from generate\_series(timestamp '2021-06-08',timestamp '2021-06-11',interval '1 day') as t(day)

去重计数优化

原：

select room\_id,count(distinct user\_id) from room\_user\_relate group by room\_id;

优化：

select room\_id,count(1) from ( select distinct room\_id,user\_id from room\_user\_relate group by room\_id ) as b

临时中间表查询优化

with x as ( select room\_id,user\_id from room\_user\_relate where user\_id \> 1000 ) select room\_id,user\_id from x group by room\_id

查询一段时间内，房间的最新状态

select distinct on (room\_id) room\_id,room\_status from room\_data order by room\_id,id desc;

按照条件聚合

select room\_id,sum(is\_entry) filter (where is\_entry=1) as visitor from room\_data group by room\_id;

合并多个json，例如：`{"a":1,"b":2},{"a":2,"c":1} => {"a":3,"b":2,"c":1}`

select room\_id,json\_object\_agg(key,val) from ( select room\_id,key,sum(value::numeric) val from room\_data,jsonb\_each\_text("jsonb\_column") group by key,room\_id ) t

判断值是否为空，如果为空则设置默认值

coalesce(watch,0) as watch, coalesce(product\_click\_detail,'{}'::json) as product\_click\_detail,