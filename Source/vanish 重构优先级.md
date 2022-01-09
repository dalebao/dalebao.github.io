vanish 重构优先级
=============

### 接口类：

1. group/index/get-groups & group/index/group-info
  1. UserGroupModel::getOperateAuth
  2. PermissionModel::getAuthByCode
2. book/request/get-request-list
  1. RequestModel-\>getRequestList()

### 脚本逻辑类

1. 消息发送逻辑
  1. 接口触发/第三方接口 请求发送的消息转发：现有逻辑，php 写入 redis，php 脚本读取redis，转发给go进程，go进程将数据转发给freeswitch，freeswitch 将消息转发给 kamailio。
2. 消息落库逻辑：现有逻辑，kamailio将消息写入 redis，php脚本从redis中读取（该脚本需要负责将群聊机器人消息转发到另外一个rediskey中），写入另外一个redis，另外一个php脚本从redis读取，然后写入数据库（写入数据库操作，同步，单进程）
  1. 离线消息获取接口：现有逻辑，接口打到200.98的获取离线消息接口，然后98的php组建新请求，请求200.99的另一个接口，查询离线消息
3. 消息离线推送逻辑（看不懂的逻辑）
4. 消息转发机器人逻辑：现有逻辑，kamailio 将机器人消息写入redis（或另外一个php脚本写入），python 脚本从redis中读取信息然后进行转发

### redis 大key

1. token key 所有用户的 token 都存在一个键中，只有删除用户时，才会删除对应数据
  1. user\_token
  2. user\_pc\_token