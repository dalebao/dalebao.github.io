# Redis-内存优化

## redisObject 对象

先回顾一下 redisObject 对象的定义

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

## 内存回收
redis使用引用计数法，实现垃圾的判断。但是引用计数不能解决循环引用问题，所以使用内存淘汰策略解决：

* **volatile-lru**   利用LRU算法移除设置过过期时间的key (LRU:最近使用 Least Recently Used ) 
* **allkeys-lru**   利用LRU算法移除任何key
* **volatile-random** 移除设置过过期时间的随机key 
* **allkeys-random**  移除随机key
* **volatile-ttl**   移除即将过期的key(minor TTL) 
* **noeviction**  noeviction   不移除任何key，只是返回一个写错误 ，默认选项

## 内存共享(refcount属性)：

当两个不同的键，都设置为相同的整数时，可以使用引用计数来做内存共享。但是只支持整数，因为判断整数对象是否相等的时间复杂度为O(1)，字符串的为O(n)，hash等为O(n2)。

## lru（对象空转）：

通过当前时间减去**redisObject**中的**lru**，可以计算出当前键的空转时长。在内存不足时，可以利用改字段手动的删除一些不常使用的键作为应急手段。另外也是 **volatile-lru** 实现的基础。