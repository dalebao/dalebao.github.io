# 行锁的添加与释放（两阶段锁）

何时添加：需要行锁的时候添加，比如 update table set id = 6; 此时 id 为 6 的数据会被上锁。

何时释放：commit 之后，也就是事务提交之后释放。

如何利用两阶段锁优化 sql：

寻找出对并发影响度最大的 sql，将 sql 放到最后执行以增大事务并发度。

例如，购买用户支付 100 元购买电影票：

1. 扣除用户余额电影票钱 100 元
2. 给影院余额增加电影票钱 100 元
3. 为以上操作记录日志

以上行为，需要两条 update 语句，一条 insert 语句，分析以上的 sql

更新用户余额，对并发需求较小，一个用户一次支付只会触发一次

更新影院余额，对并发需求较大，该影院每卖一张票都要对该数据进行更新

所以，可以将 sql 的执行顺序排列为 3-\>1-\>2，最大程度的提高并发

# 死锁与死锁检测

## 死锁

对资源发生循环依赖时会发生死锁，例如：

时间 session 1session 2

t1

begin

begin

t2

update tableA set b = 1 where id = 1;

update tableA set b = 1 where id = 2;

t3

update tableA set b = 1 where id = 2;

update tableA set b = 1 where id = 1;

以上 sql 会发生死锁，session1 对 id =1 加上行锁，session2 对 id=2 加上行锁，t3 时刻，session1 需要等待 session2 释放 id=2 的行锁，session2 同样需要等待 session1 释放 id=1 的行锁。

解决死锁的策略：

1. 设置超时，超时时间过了之后释放锁。但不能设置的太短，否则容易误伤较大的事务。
2. 死锁检测，自动检测死锁，检测到死锁就释放回滚其中一个事务。

死锁检测，需要再加锁前检测该数据是否被加锁。

避免并发度高了之后对同一数据更新时出现的性能问题，更新同一数据，在进入引擎前排队。另外，可以考虑将一个数据进行逻辑拆分，例如：影院余额的更新十分频繁，可以考虑将影院余额数据拆分成十分，影院余额是十分的总和，更新的时候随机更新某一条数据，这样可以将数据的更新分散开。

# bin log 写入机制

1. 事务执行时写入 bin log cache
2. 事务提交时写入 bin log

事务写入 binlog 不能拆分，不管事务多大都必要一次写入。

binlog 刷盘的三种策略（sync_binlog）

1. sync_binlog=0，每次事务只 write（写 pagecache），不 fsync
2. sync_binlog=1，每次事务都 fync（写磁盘）
3. sync_binlog=N，每次事务都 write，积累 N 个事务之后刷盘（系统宕机重启可能会丢失 N 个事务的数据）

# 主-主备份模式下的循环更新问题

客户端在节点 A 更新一条数据，生成 binlog，然后将 binlog 发送给节点 B，节点 B 更新完数据之后也会生成 binlog，由于节点 A 也是节点 B 的备库，所以会将 binlog 发送给节点 A，于是会发生循环更新的问题。

解决方案：

两个节点的 serverid 不能相同，如果相同不能互为主备。

在 binlog 中记录命令第一次执行的 serverid，如果 serverid 相同就不执行。

于是，节点 A 执行的命令生成 binlog 记录的都是节点 A 的 serverid，同步到节点 B 之后，将数据传输给节点 Abinlog 记录的也是节点 A 的 serverid，当 binlog 回到节点 A 之后，节点 A 判断 binlog 的 serverid 与自己的相同则不执行。
