consumer group
--------------

kafka将每个消费者的消费的当前 offset 存放在指定的 topic 中（或者zookeeper），这个 offset 基于客户端提供的某个名字。这个名字被称为 consumer group。

kafka 确保每条消息只能被同一个 consumer group 消费一次，但同时可以被不同的 consumer group 消费。

consumer rebalance
------------------

kafka 确保消息只会被同一个 *consumer group 中* 的一个 consumer 消费，其实是确保稳定状态下每一个 consumer 实例只会消费某一个或多个特定的 partition。

劣势：无法保证 consumer group 中每个 consumer 进行均匀的消费。

优势：

1. 每个 consumer 不需要和 broker 进行大量的消费，减少通信开销，降低分配难度
2. 同一个 partition 中的数据是顺序写入的，可以保证单个 consumer 是顺序消费的

consumer rebalance 算法如下：

1. 将目标 topic 下所有 partition 进行排序，记为：P
2. 将 consumer group 中所有 consumer 进行排序，记为：C，第 i 个记为 Ci
3. N = size(P)/size(C)，向上取整，意味着，如果size(P)=2，size(C) = 3，则N=2；
4. 接触 Ci 对原来分配的 partition 的消费权
5. 将第 i\*N 到 (i+1)\*N -1 个 partition 进行分配

之前版本，consumer group rebalance 控制策略是由每一个consumer 通过 zookeeper 上注册watch完成的，在consumer 创建的时候，会触发 consumer group rebalance。

consumer 只关心自己消费的 partition，在 consumer 与 partition 增加或者减少时，都会触发rebalance。当一个 consumer 触发rebalance时，其他的 consumer 也需要重新 rebalance。

缺陷：

1. 调整结果不可控

所有的 consumer 都不知道其他的 consumer 的rebalance 是否成功。kafka 会工作在一个不确定状态中。

1. 脑裂

依赖于 zookeeper 判断其他的 consumer 是否宕机，可能会造成不同 consumer 在相同时刻看到的view不一致，导致不断 rebalance。

1. **Herd effect**

任何 broker 或者 consumer 的增加或宕机，都会触发所有 consumer 的rebalance。

新版本处理以上问题：

由 GroupCoordinator 进行 rebalance 控制
----------------------------------

### 组协调器 GroupCoordinator

每个 consumer group 都会选择一个 broker 来作为自己的组协调器，负责监控消费组下所有的 consumer 的心跳，以及判断是否宕机，然后判断是否开启 消费者 rebalance。

consumer group 中的每个 consumer 在创建时，都会向集群中 某个 consumer 发送FindCoordinatorRequest请求，询问对应的 组协调器，然后建立链接。

### 加入消费组

消费者在连接上组协调器之后，会发送一个 JoinGroupRequest 请求，然后 组协调器选择 consumer group 中第一个加入的 consumer 作为 leader，将信息传送给该 leader。接着，该 leader 指定分区策略。（由于rebalance等策略有客户端配置决定，因此分区方案需要consumer来制定，以消费组协调器的配置为准）

### 发送Sync Group

leader 将分区信息发送给组协调器，然后组协调器将信息发送给各个consumer。