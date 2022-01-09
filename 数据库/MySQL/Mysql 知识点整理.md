mysql 的结构
---------

mysql 主要分为server层以及存储引擎层。

server层主要包括：

1. 连接器：负责跟客户端建立链接、获取权限、维持和管理链接。
2. 查询缓存：之前执行过的语句会以key-value的形式缓存在内存中，不建议使用（数据更新频繁的场景下，可以用 SQL\_CACHE 显示的开启）。
3. 分析器：词法分析，判断词法是否正确，确定是查询、更新、插入或者删除操作。
4. 优化器：在表中有多个索引的时候，判断使用哪个索引。
5. 执行器：从存储引擎中获取对应的数据

存储引擎主要支持：

1. InnoDB
2. MyISAM
3. Memory

更新数据的流程（InnoDB下）
----------------

1. 执行器向存储引擎要 满足where 条件的数据
  1. 如果本来就存在于内存，直接返回
  2. 不存在，则读取磁盘后返回
2. 执行器拿到数据，做指定的修改，然后交给存储引擎存储
3. 引擎将数据更新到内存，同时将数据记录到redo log中，此时 redo log 为 prepare 状态，告知执行器随时可以提交事务。
4. 执行器生成这个操作的 binlog，并将数据写入磁盘。
5. 执行器调用 引擎的提交接口，将redo log 改为 commit 状态。

BinLog 与 Redo log
-----------------

1. binlog 是 mysql server 层实现，所有引擎都可以使用。
2. redo log 是innodb 特有的，是 innodb 实现 crash-safe 能力的关键。
3. redo log 是物理日志，记录在某个数据上做了什么修改
4. bin log 是逻辑日志，记录这个语句的原始逻辑，比如：给Id=2这一行的c字段+1
5. redo log 是循环写，空间有限
6. bin log 可以追加写入，一个文件写完可以写另外一个文件

### bin log 的写入机制

事务执行过程中先写 binlog cache，提交的时候再写binlog文件。binlog cache 是系统分配一块空间，每个线程都有自己的一个binlog cache，但是最终写入的binlog文件都是一个。

sync\_binlog控制binlog写入：

1. sync\_binlog = 0;表示每次都只write，不fsync
2. Sync\_binlog = 1;表示每个事务都要 write + fsync
3. sync\_binlog = n; 表示每个事务都 write 但是 n个事务之后才 fsync

write：指将binlog cache 中的内存写到 page cache 中，并没有持久化。

fsync：指将数据写入磁盘，此时占用 磁盘IO

选择将 sync\_binlog = n，适当的增大n可以提高性能，但是坏处就是可能会损失n个事务。

### redo log 的写入机制

事务执行的中间过程，redo log 写在 redo log buffer 中。

innodb\_flush\_log\_at\_trx\_commit控制 redo log的写入：

1. 0，redolog 只写入 redo log buffer 中
2. 1，每次事务提交，将redo log持久化到磁盘中
3. 2，每次事务提交，都只是将 redo log write 到 page cache中

InnoDB 后台有一个线程，每秒将 redo log buffer 中的数据 write+fsync 持久化到磁盘中。也就是说，一个没有执行完的事务也有可能已经被持久化到磁盘中。

### 组提交

日志逻辑序列号（LSN）：LSN 是单调自增的，用来对应redo log的一个个写入点，每次写入长为length的redo log，LSN 都会加length。

在 fsync 调用中间，有越多的事务处于 prepare 阶段，一次性fsync的数据越多。

当一个事务要写盘的时候，会将处于 prepare 阶段的所有事务一起写入（LSN最大的那个）。这个事务写完的时候，LSN小于写入时候确定的LSN的都已经写入了

实际上，在 redo log write 之后，bin log 就可以执行 write 了。在bin log write 完之后，会执行 redo log 的 fsync+prepared，然后再执行 binlog 的fsync。这样bin log 也可以参与到组提交中。而且，时序上依旧是 redo log 先 prepared 然后 binlog 在 fsync。

### WAL 机制优化读写就体现在这里：

1. Wal 机制是顺序写，比数据落盘的随机写效率高
2. 组提交优化io写入次数。

### 如何保证能恢复到一个月前的任一时刻

需要定期保存一个月的bin log，周期可能是一天一个，或者一周一个。当某个库被误删之后。

1. 将最近一次备份的binlog拿出，在临时库中恢复到上一个备份的数据
2. 然后将最近的备份拿出来，按需进行恢复

### 两阶段提交如何保证数据完整性

1. 写入 redo log，处于 prepare 状态，但是没有写入 binlog，此时 crash。
  1. 由于 bin log 没有写入，事务会回滚，此时数据不会同步到从库
2. 写入 redo log，处于 prepare 状态，写入binlog，但是没有提交 commit。
  1. 此时事务会提交

### 奔溃恢复的判断规则

1. 如果 redolog 中的事务标志是完整的，也就是已经有commit标志，则提交
2. 如果 redo log 中只有 prepared 标志，则判断 binlog 是否完整
  1. bin log 完整，则提交
  2. bin log 不完整，则回退

如何判断bin log 是完整的？

1. statement 格式的binlog，最后会有 COMMIT
2. Row 格式的binlog，最后会有一个 XID event
3. 通过binlog-checksum 校验 checksum 判断 binlog 是否完整

bin log 与 redo log 如何关联？

两者有一个共同的字段 XID，崩溃恢复时，会按照 XID 顺序遍历。

为什么不能直接让 bin log 支持 crash-safe 能力？

bin log 不支持恢复“数据页”（存疑，不懂）

能不能只有 redo log 没有 bin log

只考虑 crash-safe的话是可以的。但是 mysql 有很多功能依赖bin log。比如主从，高可用。

数据在落盘的时候，是从 redo log 写入的还是 buffer pool 写入的？

1. 正常运行的情况下 buffer pool中数据页被修改，与磁盘中数据不同，此时该数据页被称为脏页，刷脏页的过程与redo log 无关。
2. 崩溃恢复过程中，引擎判断一个数据页可能在崩溃恢复时丢失了更新，会读到buffer pool 中。让 redo log 更新数据。

redo log buffer 是什么？

redo log buffer 是一块内存，在一个事务执行多个更新的时候，需要再 redo log buffer 中将redo log 存储下来，之后在 commit 的时候将数据写入redo log 文件。

刷脏、BufferPool&Change Buffer
---------------------------

有两种情况，一种是redo log 满了需要进行刷脏（write point 追上 check point ）。此时，整个系统不再接受更新，需要将 check point 往前推留出空间写。

第二种就是，内存不足需要进行刷脏。

InnoDB使用 Buffer Pool 来管理内存，缓冲池中的内存页有三个状态：

1. 还没有使用的
2. 使用了且是干净的
3. 使用了 且是 脏页

当查询的一个数据没有存在于内存中时，需要在 buffer pool 中先申请一块内存页。如果已经满了，就需要淘汰一块最久不使用的一块内存页。如果被淘汰的页是干净的，那就直接淘汰。如果是脏页就需要先刷脏才能淘汰。

如果，innodb\_flush\_neighbors 设置为1，在刷脏的时候，会将邻居的脏页一起刷盘，该操作可能会蔓延。如果设置为0，刷脏就只刷自己。

### 查询数据很大会不会把 BufferPool 撑爆

mysql，采用边查边发的策略，一次查询可能会发送很多次，占用的空间有限。

### Buffer Pool

buffer pool，采用 lru 算法来保存数据页。最近访问的数据放在链表头部，数据页不足时，将链表尾部的数据删除。

可能存在一种情况：某次查询的数据很大，远远超过了 buffer pool的大小，此时原先的数据可能都会被淘汰。

应对以上的情况，buffer pool将空间按照 5:3 的比例分成了 young 和 old 区。

改进后的逻辑为：

1. 扫描过程中，需要新插入的数据页被放在 old 区域。
2. 一个数据页内有多条数据，这个数据页会被多次访问到，但由于是顺序访问，不会超过一秒，还是存在于old区域
3. 这个区域不会被访问到，会很快被淘汰。

进入young区域的条件：

1. 在lru中存在的时间超过一秒。
2. 在old的数据，每次访问的时候判断存在时长。

### Change buffer

change buffer 的目的是为了减少在更新（insert update delete）操作时的随机读磁盘IO。在更新数据时，如果数据在 Buffer Pool 中直接更新，如果不是则记录在 change buffer，然后写 redo log，等待时机merge。

何时将change buffer 写入磁盘：

1. 当修改后的数据页被查询的时候，需要进行merge。
  1. 先从磁盘中读取数据
  2. 然后应用change buffer 里的内容
2. 当 redo log 不够时
3. 后台线程定期 merge
4. mysql 服务 shutdown 时

什么业务场景适合change buffer？

写多读少的场景：因为，在写少读多的场景，可能一个事务刚把数据写到change buffer中，另外的时候就对该数据进行查询了，需要把change buffer写到磁盘上。

为什么唯一索引不适合使用change buffer？

因为唯一索引在插入和更新的时候，都需要从磁盘中查询数据，判断约束条件是否成立。

### 唯一索引与普通索引在操作上的差别

查询：基本没有区别（select \* from table where a = 1)

1. 唯一索引在查询上面的语句时，只需找到 a = 1的数据即可返回。
2. 普通索引在查询的时候，找到 a = 1 的数据之后需要找到 a != 1的数据才能返回。
3. innodb 读取数据是整个数据页一起读取的，普通索引在查询的时候，遇到满足条件的在不同的数据页上的概率很小。

更新：普通索引优于唯一索引（insert table values（id=1))

1. 唯一索引在插入的时候，需要从磁盘中查询是否已经有 id = 1 的值，判断当前数据是否满足约束
2. 普通索引可以将修改存放在 change buffer 中，然后由change buffer 的其他机制将数据刷到磁盘上

主从备份
----

主从备份依赖于binlog。主要流程如下：

1. 在备库上执行chang master 命令，设置主库的ip，端口等鉴权链接信息，以及开始备份的位置，包括了从哪个binlog 以及offset。
2. 在备库上执行 start slave。备库启动两个线程，一个 io 线程，一个sql 线程。
  1. Io 线程负责与主库之间的同步，将数据写入 relay log。
  2. sql 线程负责读取relay log，并执行

### bin log 的三种格式

1. statement：记录语句原文。但是delete 带 limit 情况下，是有可能会造成主备数据不一致的情况的。使用的索引可能不一样，由于使用索引且查询，不同的条件会查询出不同的结果。
2. row
  1. table map event： 表示接下来要操作的表
  2. delete row event：用于定义删除的行为，记录真实删除行的id
3. mixed：statement 与 row的混合体
  1. statement 可能造成主从不一致
  2. row 占用空间较大
  3. MySQL 自动判断会不会发生主从不一致，选择使用 statement 或者 row

[MySql 主从复制](evernote:///view/32713371/s44/5ca0793b-6493-4393-b008-42bc34dbbc2d/5ca0793b-6493-4393-b008-42bc34dbbc2d/)

MVCC 与 事务
---------

[MVCC&事务](evernote:///view/32713371/s44/b403d992-71ad-4b45-954d-6c847d92d446/b403d992-71ad-4b45-954d-6c847d92d446/) [mysql 面试题](evernote:///view/32713371/s44/d4801b99-6f24-4d14-8042-86f71410fd17/d4801b99-6f24-4d14-8042-86f71410fd17/)

RR 与 RC 隔离级别的区别以及何时使用
---------------------

1. RC 级别 read view 生成时机，在每条sql的时候（所以会读到已提交）
2. RR 级别 read view 生成时机，在第一条sql执行的时候
3. RC 级别使用半一致读，为了避免锁竞争（update 语句中的 where 如果查询到已经加锁的数据，那么交给mysql判断是否要加锁）
4. RR 级别两阶段锁机制+next key lock （行锁加上gap lock）降低并发
5. RC 级别不支持在binlog 存储 statement 格式数据，只能用 row

从 RC 改为 RR 目的是为了减低读过程中 read view 创建次数提升性能。

从 RR 改为 RC 目的是为了降低在更新过程中 锁 对性能的影响。

ACID
----

A: 原子 要么都做 要么都不做。基于 undo log 实现。

D : 持久 redolog binlog crash-safe 能力

I：隔离 锁机制 + MVCC 

C： 一致性，最终目标 所有的机制都是为了保证一致性