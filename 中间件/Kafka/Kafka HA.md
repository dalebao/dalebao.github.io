Kafka 什么时候向生产者发送ack
-------------------

生产者 在发送消息之后，需要kafka确认收到消息。正常返回ack有几种方式：

1. kafka 收到消息之后，直接返回 ack。
2. kafka 收到消息之后，等待半数follower 确认，返回ack。
3. kafka 收到消息之后，等待全部 follower 确认，返回ack。

为了确保，leader 在返回 ack 之后宕机，从 follower 中选举出新的 leader之后不会造成数据的丢失，第一种是肯定不行的。

kafka 采用的是介于 第二种 与 第三种 之间的策略。维护动态的 ISR 列表。

ISR 列表
------

In Sync Replicas，消费者 在 往kafka 发送消息时，至于 leader 发生交互，leader 之后还有许多 follower。leader 在收到消息之后，需要 follower 返回消息才能正常返回ack。但若其中有一个或者几个follower 复制的特别慢，是会很影响并发与吞吐的。所以，只需要 ISR 列表中的 follower 确认，即可以返回ack。

ISR 列表的选择：

1. 首先，需要通信足够快，时间默认10s。
2. 与 leader 之间的数据量差（后被移除）

移除的原因：

1. kafka 是批量消费，很容易达到阈值，会造成节点频繁的进出 ISR 列表

数据可靠性保证 ACK 参数
--------------

1. Ack = 0

消费者只管丢数据，不关心 leader 是否将数据落盘，很容易丢数据。

1. Ack = 1

leader 落盘后返回，也会出现数据丢失，因为leader在落盘之后出现故障，follower 中都没有该数据。

1. Ack = all（-1）

leader 和 follower（ISR）都落盘才会返回ack。会出现数据重复现象，在leader 与 follower 都已经落盘的时候，ack 出现问题，producer 会重新发送消息。极端情况下会出现数据丢失，假设 ISR 列表中只有一个 leader，那就和 ack = 1时的情况一样了。

消费数据一致性的保证 HW
-------------

LEO：指每个follower的最大的 offset

HW：指消费者能见的最大的 offset，ISR 列表中的最小的 LEO

1. follower 故障

follower 故障被踢出ISR，在重新恢复之后，该follower会读取本地磁盘中上一次的 HW，将日志中高于HW的日志都删除，再从 leader 中同步数据，当追上 新的 HW 之后，重新加入 ISR。

1. leader 故障

Leader 故障之后会从 ISR 中选出一个新的 Leader。为了保证多个副本中的数据一致，其他 follower 会将本地高于 HW 的部分截取掉（新的Leader不会截取），然后从leader中同步数据。

精准一次 exact once（幂等性）
--------------------

kafka 会为每一个消费者分配一个pid，并为每条数据分配一个 sequencenumber，若 pid partition sequencenumber 三者一致，则认为是重复数据。生产者挂掉之后，会重新生成pid，所以有可能会造成数据重复现象。

Kafka的选举
--------

1. controller 选举（broker的leader）

controller 的选举列用的 zookeeper 的强一致性。broker 在 zookeeper 的”/controller” 节点下创建临时节点，先到先得。

如果，controller 宕机，zookeeper上的临时节点被删除，其他broker会收到通知然后进行竞争。

1. leader 的选择（分区副本的leader）

分区的 leader 由controller进行管理与协调。controller 在判断出 leader 宕机之后，会将消息通知给 ISR 中的 follower。只有 ISR 列表中的 broker 才有资格被选为leader。

选择 AR 列表中的第一个且存在于 ISR 列表中的节点作为 leader。如果 ISR 列表中都宕机了：

  1. 选择第一个恢复的 ISR 列表中的broker 作为 leader；
  2. 选择第一个恢复的broker作为leader。

选择第一个恢复的 broker 作为 leader 不能保证它存在于 ISR 列表中，所以不能保证数据的一致性。

1. 消费组的leader

消费组中第一个加入消费的消费者会被消费组协调器选为消费组leader。