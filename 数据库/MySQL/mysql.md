行锁的添加与释放（两阶段锁）
==============

何时添加：需要行锁的时候添加，比如 update table set id = 6; 此时id为6的数据会被上锁。

何时释放：commit之后，也就是事务提交之后释放。

如何利用两阶段锁优化sql：

寻找出对并发影响度最大的sql，将sql放到最后执行以增大事务并发度。

例如，购买用户支付100元购买电影票：

1. 扣除用户余额电影票钱100元
2. 给影院余额增加电影票钱100元
3. 为以上操作记录日志

以上行为，需要两条update语句，一条insert语句，分析以上的sql

更新用户余额，对并发需求较小，一个用户一次支付只会触发一次

更新影院余额，对并发需求较大，该影院每卖一张票都要对该数据进行更新

所以，可以将sql的执行顺序排列为3-\>1-\>2，最大程度的提高并发

死锁与死锁检测
=======

死锁
--

对资源发生循环依赖时会发生死锁，例如：

时间session 1session 2

t1

begin

begin

t2

update tableA set b = 1 where id = 1;

update tableA set b = 1 where id = 2;

t3

update tableA set b = 1 where id = 2;

update tableA set b = 1 where id = 1;

以上sql会发生死锁，session1 对 id =1 加上行锁，session2对id=2加上行锁，t3时刻，session1 需要等待session2释放id=2的行锁，session2同样需要等待session1释放id=1的行锁。

解决死锁的策略：

1. 设置超时，超时时间过了之后释放锁。但不能设置的太短，否则容易误伤较大的事务。
2. 死锁检测，自动检测死锁，检测到死锁就释放回滚其中一个事务。

死锁检测，需要再加锁前检测该数据是否被加锁。

避免并发度高了之后对同一数据更新时出现的性能问题，更新同一数据，在进入引擎前排队。另外，可以考虑将一个数据进行逻辑拆分，例如：影院余额的更新十分频繁，可以考虑将影院余额数据拆分成十分，影院余额是十分的总和，更新的时候随机更新某一条数据，这样可以将数据的更新分散开。

bin log 写入机制
============

1. 事务执行时写入bin log cache
2. 事务提交时写入bin log

事务写入binlog不能拆分，不管事务多大都必要一次写入。

binlog刷盘的三种策略（sync\_binlog）

1. sync\_binlog=0，每次事务只write（写pagecache），不fsync
2. sync\_binlog=1，每次事务都fync（写磁盘）
3. sync\_binlog=N，每次事务都write，积累N个事务之后刷盘（系统宕机重启可能会丢失N个事务的数据）

主-主备份模式下的循环更新问题
===============

客户端在节点A更新一条数据，生成binlog，然后将binlog发送给节点B，节点B更新完数据之后也会生成binlog，由于节点A也是节点B的备库，所以会将binlog发送给节点A，于是会发生循环更新的问题。

解决方案：

两个节点的serverid不能相同，如果相同不能互为主备。

在binlog中记录命令第一次执行的serverid，如果serverid相同就不执行。

于是，节点A执行的命令生成binlog记录的都是节点A的serverid，同步到节点B之后，将数据传输给节点Abinlog记录的也是节点A的serverid，当binlog回到节点A之后，节点A判断binlog的serverid与自己的相同则不执行。