# 如何使用 redis 实现限流

[TOC]

## 背景

在工作中时常会遇到需要对接口或者某个调用进行限流的情况。也会遇到在限流的同时对 `redis` 数据进行一些处理，在涉及到分布式的情景下，就需要操作的原子性。

## 限流算法

主流的限流算法为以下四种：

1. 计数器（固定窗口）
2. 滑动窗口（分割计数器）
3. 漏桶算法
4. 令牌桶算法

对于算法的解释，网上有很多好文章，在这里贴上[常用四种限流算法](https://blog.csdn.net/weixin_41846320/article/details/95941361)。

在本文中，讨论前两种也就是 **计数器** 以及 **滑动窗口**。

## 业务解释

限流，是在业务中经常遇到的场景。例如：对接口的限流、对调用的限流,etc。

以对接口限流为例，流程如下：

![限流流程](http://bucket-ceshi-dalebao.oss-cn-hangzhou.aliyuncs.com/2021/10/22/xian-liu-liu-cheng.png)

请求打到服务器之后，需要先判断当前接口是否达到阈值，若：

1. 达到阈值，则结束本次请求。
2. 未达到阈值，则 **计数++**，继续下一步调用。

> 限流可以有很多中办法，如果只是小型的单机部署应用，则可以考虑在内存中进行计数与操作。若是复杂的项目且分布式部署的项目，可以考虑使用 `redis` 进行计数。且限流的逻辑不一定要限于 `Java` 代码中，也可以使用 `lua` 在 `nginx` 进行操作，例如大名鼎鼎的 `openresty`，同理其他网关服务也可实现。

## 分布式业务中的限流

首先分析业务场景，在分布式部署的 api 场景中需要注意以下几点：

1. 使用网关对 api 进行负载均衡，部署在不同服务器上的进行之间内存很难做到共享。
2. 基于限流的业务，是对整个系统的某一个或者某一些接口进行限流，所以计数必须做到不同的进程都可以读取。
3. 对于计数的触发，是请求达到服务器上之后发生的，所以需要考虑原子性。即：同一时刻，只有一个请求可以触发计数。这就对计数服务的要求提出了很高的并发要求。

### 分析 nginx + lua 的可行性

`nginx` 常用于请求的入口，在使用它的负载均衡之后，可以实现将请求分发到不同的服务上。使用 `lua` 对内存进行操作，似乎可以实现上述要求（可行性待验证）。

但是，在实际情况中，一个系统并一定只会部署一个 `nginx` 作为入口。一方面是单机风险，另一方面是地理位置的不同，网络的不同对同一台机器的访问速度可能会有天差地别。所以，大家更喜欢使用 DNS 或者其他将请求达到多态 `nginx` 先做一层负载均衡。所以，单是 `nginx` + `lua` 并不能达到我们的需求。

### 分析 redis 的可行性

`redis` 是基于内存的一种非关系型数据库，它的并发是经得住考验的，同时它也可以满足不同进程对相同数据读取、修改的需求。

对于原子性，`redis` 操作天生支持原子性，而且 string 类型的 INCR（原子累加） 操作与 限流 业务又十分的契合。

## redis 实现限流

让我们再回到一开始的流程，计数限流的操作有：

1. 查询当前计数
2. 累加当前计数

在分布式系统中，必须要时刻注意 原子性。在单一进程中，我们保持数据线程安全的办法是加锁，无论是可重入锁还是`synchronized`，其语义都是告诉其他线程，这个数据（代码块）我现在征用了，你们等会再来。那在分布式系统中，我们自然而然的可以想到**分布式锁**。

伪代码如下：

```java
Lock lock = getDistributedLock();

try{
    lock.lock();
    // 从 redis 中获取计数
    Integer count = getCountFromRedis();

    if(count >= limit){
        // 超过阈值，不予调用
        return false;
    }
    // 未超过阈值，允许调用
    incrRedisCount();
    return true;
}catch{
    ...
}finally{
    lock.unlock();
}

```

乍一看，这种逻辑没有问题，但其实问题很大：

1. 使用分布式锁明显会拖慢整个系统，浪费很多资源。
2. redis incr 操作会返回累加之后的值，所以查询操作是不必须的。

伪代码如下：

```java
Integer count = incrRedisCount();
if (count >= limit){
    return false;
}
return true;
```

是不是变的简单了很多。但是随之而来的有其他的问题，大部分的业务都不是要求我们只对次数进行限制，更多的是要求我们限制接口在一段时间内的请求次数----滑动窗口。

### 滑动窗口的实现

顾名思义，滑动窗口就是将一个固定的窗口滑动起来。用于限流上来说就是，一段时间内进行计数，时间一过，立马开始新的计数。
如何实现 **一段时间** 这个逻辑？
其实很简单，我们完全可以使用 时间戳 来实现这一功能。

```java
// 秒级时间戳
long timestamp = System.currentTimeMillis() / 1000;
Long aLong = redisTemplate.opsForValue().increment(RedisKeyEnum.SYSTEM_FLOW_LIMIT.getKey() + timestamp);
return aLong;
```

此时会有一个问题，如果按以上代码来看，每秒创建一个键，那 redis 内存迟早会被撑爆。我们需要一个策略来删除这个键。
笨的方法，可以记录这些键，然后异步去删除这些键。但是更好的方法是，在键第一次创建的时候设置一个稍大于窗口的过期值。所以，代码如下：

```java
    /**
     * 按秒统计发送消息数量
     *
     * @return
     */
    public Long getSystemMessageCountAtomic() {
        // 秒级时间戳
        long timestamp = System.currentTimeMillis() / 1000;
        Long aLong = redisTemplate.opsForValue().increment(RedisKeyEnum.SYSTEM_FLOW_LIMIT.getKey() + timestamp);
        if (aLong != null && aLong == 1) {
            redisTemplate.expire(RedisKeyEnum.SYSTEM_FLOW_LIMIT.getKey() + timestamp, 2, TimeUnit.SECONDS);
        }
        return aLong;
    }
```

只有在第一次计数的时候才会执行 `expire` 命令。为什么需要设置稍大于窗口的时间呢？
想象一下，如果设置和窗口一样的时间，在 a 时刻的时候生成的键 keyA，然后过期时间是一秒。然后在 b 时刻，生成的键也是 keyA（在同一秒内），但是由于网络或者其他原因，b 时刻的命令在一秒之后才发送到 redis server。由于过期时间是一秒，此时旧的 keyA 已经过期，那么 b 时刻就会创建一个新的键。

此时，需要考虑另外一个问题，如果超过限制，以上代码会如何表现。

假设，一秒钟内只允许请求 100 次。那么第 101 次，也会去 redis 中执行 incr 命令，往后的请求都会执行。其实这些命令的执行时没有意义的，因为第 101 次时，这一秒的请求已经到限制了，所以我们需要另外一个存储来记录以上数据。

我选用 AtomicLong 来记录已经到限的窗口。分析一下是否可行。

1. AtomicLong 属于 java.util.concurrent.atomic 包，采用 CAS 与 volatile 来保证数据的线程安全。
2. 上述需求，我们只需要在单机上记录 flag 即可，不需要考虑分布式情况。

论述可行，以下展示代码。

```java
private final AtomicLong flag = new AtomicLong();

/**
     * 系统全局流量限制
     */
    public void systemFlowLimit() {
        // 判断 flag 是否与当前秒相同
        if (flag.get() != System.currentTimeMillis() / 1000) {
            // 由于 flag.get 到 flag.set 之间的所有操作组合之后 不具备原子性，所以会有 小于 线程数 的线程会进入到这里面。
            // 意思是，当 第一个 线程将 flag 设置为 当前秒级 时间戳之后， 会有一部分线程已经执行完 flag.get 的判断逻辑
            // 此时，部分线程会继续 redis 操作与 日志操作
            Long count = systemLimitService.getSystemMessageCountAtomic();
            if (count >= systemProperties.getFlowLimit()) {
                // 超过之后会将flag 设置为当前秒
                flag.set(System.currentTimeMillis() / 1000);
                LOGGER.warn("system flow now is out of system flow limit,at:{}", System.currentTimeMillis() / 1000);
                throw new BusinessException(...);
            }
        } else {
            throw new BusinessException(...);
        }
    }
```

## 总结

以上整理了使用 redis 做限流的一些方法，经常使用的算法便是滑动窗口，所以花了较大笔墨解释滑动窗口的实现。

当然，我们还可以使用 lua 脚本来操作 redis 以实现限流与其他 redis 操作的配合。

我经常遇到的一个场景就是，往 redis 队列中写数据需要进行限流，当流量达到之后需要删除部分 redis 队列中的内容。此时，使用 lua 脚本来做可以很优雅的保持多个 redis 操作的原子性，也可以减少网络情况的开销。
