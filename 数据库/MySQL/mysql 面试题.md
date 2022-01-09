MVCC是什么？解决什么问题
--------------

MVCC：多版本并发控制，用无锁的方式解决事物之间读写冲突的问题。也就是脏读的问题。

MVCC如何实现：
---------

mysql （innodb）中的实现：

在mysql中，mvcc依赖于快照读。快照的生成基于数据的两个隐藏字段（最新修改的事务id，指向存储在undo log中上一版本数据的指针）。在查询时，innodb为事务保存当前活跃事务的id 数组。寻找当前事务可见数据版本的判断如下：

1. 数据最新修改的事务id，与当前活跃事务的id 数组比较，如果该事务id 比 当前活跃的事务id数组的最小值小，说明当前的事务都没有对该数据进行修改，本条数据当前事务可见。
2. 数据最新修改的事务id，包含于当前活跃事务id数组，说明当前活跃的事务有修改本条数据，当前活跃的事务必然是未提交的（有没有可能已提交的事务id被记录在当前的活跃的事务id数组中？rr 级别在第一条sql查询时创建 活跃事务id组，有可能。rc 级别每次sql查询都会创建，所以不可能），所以本条数据当前事务不可见。此时，根据数据的指向undolog上一版本数据的指针去undolog中寻找数据，并重复1，2步骤寻找出合适的数据。

快照何时生成
------

rr级别下，开启事务并不会立马生成快照，而是在第一次查询时生成快照。注意：select 生成快照是事务中所有表的快照一起生成；update 语句不会生成快照。

rc级别下，是在每次select都会生成快照。read commited 产生的原因（rc级别快照生成的时机）

快照可以解决为当前活跃的事务id

mvcc能解决幻读吗？
-----------

不能，mvcc不能解决幻读的问题，因为幻读的产生的原因是，现有数据与查询数据之间的间隙的插入为加锁造成的。比如，数据存在id=1,5两条数据，此时A事务要插入id=2，逻辑为先查询再插入。B事务与A事务执行一样的逻辑，但是B事务执行的更快。B事务先插入了id=2，并提交，此时A事务再插入id=2将会导致插入失败（唯一键），数据不一致（sql语义不一致）的问题。

Innodb如何解决幻读
------------

next-lock key，gap（间隙锁）+ 行锁 组成 next-lock key。

间隙锁如何加锁
-------

例如 表内有 主键 id，普通字段 b，数据如下：

id

b

5

5

10

10

15

15

当有一条查询为 select \* from table where id = 6 lock in share mode 时，此时 id =6 查询走索引，将会用间隙锁锁住(5,10]之间的数据，也就是说，别的事务想要插入一条id为6，7，8，9的数据都会被间隙锁阻塞。但是10-15，15到正无穷大的数据没有影响。

当有一条查询为 select \* from table where b = 6 lock in share mode 时，此时，b = 6 查询未走索引，间隙锁将会加上 (0,5],(5,10],(10,15],(15,正无穷]4把锁，锁定全表。

buffer pool 如何管理内存 lru + 新老代链表

[https://blog.csdn.net/wuhenyouyuyouyu/article/details/93377605?utm\_medium=distribute.pc\_relevant.none-task-blog-2~default~baidujs\_baidulandingword~default-0.no\_search\_link&spm=1001.2101.3001.4242.1](https://blog.csdn.net/wuhenyouyuyouyu/article/details/93377605?utm_medium=distribute.pc_relevant.none-task-blog-2~default~baidujs_baidulandingword~default-0.no_search_link&spm=1001.2101.3001.4242.1)