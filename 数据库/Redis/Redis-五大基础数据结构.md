> redis 的数据，分为键与值两部分，皆由 redisObject 实现。

redisObject 结构主要说明对象的底层编码方式，以及实际指向等内容：

```c
/*src/redis.h/redisObject */
typedef struct redisObject {
    // 刚刚好32 bits
    // 对象的类型，字符串/列表/集合/哈希表
    unsigned type:4;
    // 未使用的两个位
    unsigned notused:2; /* Not used */

    // 编码的方式，Redis 为了节省空间，提供多种方式来保存一个数据
    // 譬如：“123456789” 会被存储为整数123456789
    unsigned encoding:4;

    // 当内存紧张，淘汰数据的时候用到
    unsigned lru:22; /* lru time (relative to server.lruclock) */

    // 引用计数
    int refcount;

    // 数据指针，指向真正的数据
    void *ptr;
} robj;
```

## 字符串对象

1. 实现方式

- int 编码：用 long 存储整形
- raw 编码：保存大于 44 字节的字符串

当为 raw 编码时：

1. 正常使用 raw，**redisObject** 与 **sds** 保存数据，需要分别分配 **redisObject** 与 **sds**
2. embstr 编码：保存小于 44 字节的字符串 使用 **redisObject** 与 **sds** 保存数据，两者存储在一块连续的内存上，只需要分配一次。专门用于小字符串存储的优化结构
3. 扩容需要重新分配内存，所以 embstr 为只读。修改时，会变为 raw 编码。

**应用**
原子累加，分布式 session 等

## 列表对象

实现方式：

- ziplist
- linkedlist

列表保存元素小于 512 个
每个元素长度小于 64

**应用**

简单消息队列，抢红包，抢购等操作。

## Hash 对象

实现方式：

- ziplist
- hashtable

字典保存元素小于 512 个
每个元素长度小于 64

**应用**

存放个人信息等

## Set 对象

实现方式：

- intset
- hashtable

当满足以下条件时，使用 intset：

- 所有值都是整形
- 数量不超过 512

**应用**
去重，可以利用交集，并集，差集操作实现相同爱好，不同爱好等操作

## ZSET 对象

实现方式：

- **有序链表**
- **ziplist**

1. 当使用 ziplist 的时候，使用两个相邻的节点存储值与 score，一个节点存储值，第二个节点存储 score
2. 当使用跳跃表实现的时候，会有一个字典与一个跳跃表：
   1. 字典：字典的键存储值，字典的值存储 score
   2. 跳跃表的 object 存储值，score 存储分值

使用字典查询单个值，实现 O(1)的复杂度。使用跳跃表实现 score 的范围查询，时间复杂度为 O(logn)。

**应用**

排行榜，有序的存储，topN
