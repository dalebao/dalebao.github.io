![](resources/7B367675D89CEF99F0D9ED9743930276)

安装与使用
=====

[查看官方文档](https://pulsar.apache.org/docs/zh-CN/standalone-docker/)

[组件](https://pulsar.apache.org/docs/zh-CN/concepts-architecture-overview/)
==========================================================================

Broker
------

负责处理和负载均衡 producer 发出的消息，并将这些消息分派给 consumer ；

将这些消息存储在 bookkeeper 实例，bookie 中。

Booker依赖zookeeper处理特定业务，

注意：pulsar中的broker是一个代理，它对消息的读取与存储的复杂性流程进行屏蔽。而kafka的broker是用于负责处理分区，一个Kafka节点就是一个broker。

Apache BookKeeper
-----------------

负责消息持久化存储

Apache ZooKeeper
----------------

用来处理多个Pulsar集群之间的协调任务

存储结构
====

心就是Apache BookKeeper。

BookKeeper 是一个分布式的预写日志（WAL）的存储系统。

如上图所示：

1. 一个tpoic拥有多个segment，消息以segment的形式存储在bookie上
2. broker 以一定的规则将topic的不同的segment存储在不同的bookie上

扩容
--

可以简单的将一个订阅理解为一个消费组，方便理解。

独占（Exclusive）\<[](resources/)序的，适合于用于需要保证消息顺序的场景。（此顺序为pulsar收到消息的顺序）类似于rabbitmq。
--------------------------------------------------------------------------------------

灾备（FailOver）
------------

与独占模式类似，只是允许有另一个相同订阅名的订阅进行备份消费。以防在消费者消费失败后数据的丢失，可以交给另外一个消费者消费。

共享（Shared）
----------

允许有多个相同订阅名的订阅进行消费，会将消息分发给不同的消费者。且消费者的增加/减少不受限制。

键共享（Key\_Shared）
----------------

按照key对消息进行分发，其余与Shared大体相同。

通过以上内容可以看出pulsar相对于kafka在消费上有以下优势：

1. Kafka的消费者数量受限于分区数量，增加消费者数量需要增加topic分区数，减少消费者数量需要重建topic
2. pulsar的消费者数量，在Shared模式下可以随意增加、减少。
3. pulsar可以对一个topic进行消费模式的组合，可以同时对一个topic进行单消费者顺序执行/多消费者并行执行。kafka不能实现以上场景。