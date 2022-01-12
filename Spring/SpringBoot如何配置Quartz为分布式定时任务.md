# SpringBoot 如何配置 quartz 为分布式定时任务

## 背景

项目需要一个分布式的定时任务，预研之后选择使用 `quartz`。
`quartz` 的分布式需要依赖关系型数据库支持存储一些任务信息。建表 sql 存在于 `quartz` 项目中，[github 可见](https://github.com/quartz-scheduler/quartz/tree/d42fb7770f287afbf91f6629d90e7698761ad7d8/quartz-core/src/main/resources/org/quartz/impl/jdbcjobstore)
库中提供了多种数据库的执行 sql，我的项目采用的 `postgres` 作为持久化数据库。

## 配置 quartz

**QuartzJobFactory**

```java
/**
 * quartz job factory
 *
 * @author Dale
 */
@Component
public class QuartzJobFactory extends AdaptableJobFactory {

    @Autowired
    private AutowireCapableBeanFactory autowireCapableBeanFactory;

    @Override
    protected Object createJobInstance(TriggerFiredBundle bundle) throws Exception {
        Object jobInstance = super.createJobInstance(bundle);
        autowireCapableBeanFactory.autowireBean(jobInstance);
        return jobInstance;
    }
}
```

**QuartzConf**

```java
/**
 * 配置分布式 quartz
 *
 * @author Dale
 */
@Configuration
public class QuartzConf {

    private QuartzJobFactory quartzJobFactory;

    @Resource(name = "master")
    private DataSourceProperties masterProperties;

    @Autowired
    public void setQuartzJobFactory(QuartzJobFactory quartzJobFactory) {
        this.quartzJobFactory = quartzJobFactory;
    }

    @Bean
    public SchedulerFactoryBean schedulerFactoryBean() throws IOException {
        PropertiesFactoryBean propertiesFactoryBean = new PropertiesFactoryBean();
        // 设置 quartz 的配置文件是 classpath 下的 quartz.properties 文件
        propertiesFactoryBean.setLocation(new ClassPathResource("quartz.properties"));
        propertiesFactoryBean.afterPropertiesSet();
        SchedulerFactoryBean schedulerFactoryBean = new SchedulerFactoryBean();
        schedulerFactoryBean.setQuartzProperties(Objects.requireNonNull(propertiesFactoryBean.getObject()));
        schedulerFactoryBean.setJobFactory(quartzJobFactory);
        schedulerFactoryBean.setApplicationContextSchedulerContextKey("applicationContextKey");
        schedulerFactoryBean.setWaitForJobsToCompleteOnShutdown(true);
        schedulerFactoryBean.setOverwriteExistingJobs(false);
        schedulerFactoryBean.setStartupDelay(10);
        // 设置 quartz 的DataSource 为主库的配置
        schedulerFactoryBean.setDataSource(masterProperties.initializeDataSourceBuilder().type(DruidDataSource.class).build());
        return schedulerFactoryBean;
    }


    @Bean(name = "scheduler")
    public Scheduler scheduler() throws IOException {
        return schedulerFactoryBean().getScheduler();
    }

}
```

> 注意：由于项目先前配置了数据库的主从分离，所以公用数据库链接，避免额外再有一处数据库连接配置。

**quartz.properties**

```yaml
org.quartz.scheduler.instanceName=liveScheduler
org.quartz.scheduler.instanceId=AUTO

org.quartz.jobStore.useProperties=true
org.quartz.jobStore.isClustered=true
# 由于使用 postgres，quartz 的表并不是建在 publish schema 下，所以需要在 tablePrefix 设置schema的名字
org.quartz.jobStore.tablePrefix=quartz.qrtz_
org.quartz.jobStore.class=org.quartz.impl.jdbcjobstore.JobStoreTX
org.quartz.jobStore.driverDelegateClass=org.quartz.impl.jdbcjobstore.PostgreSQLDelegate
```

## 使用

先定义一个 job

```java
@Repository
public class LotteryJobs implements Job {

    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        // todo::
    }

}
```

然后调用

```java

JobDetail jobDetail = JobBuilder.newJob(LotteryJobs.class).withIdentity("lottery-" + lotteryEntity.getId()).build();
jobDetail.getJobDataMap().put("lotteryId","");
jobDetail.getJobDataMap().put("roomId", "");
Trigger trigger = TriggerBuilder.newTrigger().withIdentity("lottery-" + lotteryEntity.getId()).startAt(getLotteryTime()).build();
try {
scheduler.scheduleJob(jobDetail, trigger);
    } catch (SchedulerException e) {
        LOGGER.error("lottery schedule create error,lotteryId:" + lotteryEntity.getId(), e);
        throw new BusinessException(ApiCode.ERROR);
    }
```
