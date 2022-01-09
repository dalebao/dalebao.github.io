binlog
------

1. Binlog 的写入流程
  1. 先写入 binlog cache
  2. 事务提交之后 写入 binlog 文件
2. Binlog 写入时机
  1. 0 只写入 文件 不刷盘
  2. 1 每个事务都刷盘
  3. n 次事务之后再刷盘

可能出现，主机宕机之后，丢失n个事务的数据。

redo log
--------

1. 两阶段提交
  1. 更新数据，先更新 redo log，然后更新内存，此时通知执行器随时可以commit，redo log 处于prepare 阶段
  2. 然后写 bin log，再将 redo log 标计为commit 状态。
2. 两阶段提交的目的：
  1. 保证两个日志（redo log bin log）数据的一致性
3. 为什么需要有 redo log
  1. crash safe 能力