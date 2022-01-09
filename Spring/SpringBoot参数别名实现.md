# SpringBoot 参数别名实现

## 背景与痛点

项目中经常出现一种情况：定了某个参数之后，前端又要求改参数名字，而你又不想因为这个名字而改变代码的优雅，于是就需要拥有一个参数对应两个参数名的能力。
具体来说：业务拥有自定义协议，在java实体中定义的名字是全名，例如：`name` getter、setter 分别为 `getName()` 和 `setName(String name)`。
但是，在协议转发的过程中需要使用简写来优化消息体的大小`{"nm":"Dale"}`,不知道何种原因，前端要求使用`nm`对应原有的`name`。

## 思路

使用`注解`设置参数的别名，将别名与实体的参数名绑定。然后再利用`ExtendedServletRequestDataBinder.addBindValues`重新将别名对应的值与实体的参数名对应。有些拗口，以背景中的例子为例：接收到的参数为`nm`，值为`Dale`。经过绑定之后，将`nm`的值绑定到`name`上。

废话不多，直接上代码。

## 代码

**ValueFrom**

```java
/**
 * 请求参数别名注解
 *
 * @author Dale
 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface ValueFrom {

    /**
     * 参数别名列表
     */
    String[] value();
}
```

**AliasDataBinder**

```java
/**
 * 别名数据绑定
 *
 * @author Dale
 */
public class AliasDataBinder extends ExtendedServletRequestDataBinder {

    public AliasDataBinder(Object target, String objectName) {
        super(target, objectName);
    }

    @Override
    protected void addBindValues(MutablePropertyValues mpvs, ServletRequest request) {
        super.addBindValues(mpvs, request);
        Class<?> targetClass = Objects.requireNonNull(getTarget()).getClass();
        Class<?> targetFatherClass = targetClass.getSuperclass();
        // 利用反射获取类的字段
        Field[] fields = targetClass.getDeclaredFields();
        Field[] superFields = targetFatherClass.getDeclaredFields();

        for (Field field : fields) {
            ValueFrom valueFromAnnotation = field.getAnnotation(ValueFrom.class);
            if (mpvs.contains(field.getName()) || valueFromAnnotation == null) {
                continue;
            }
            for (String alias : valueFromAnnotation.value()) {
                if (mpvs.contains(alias)) {
                    mpvs.add(field.getName(), Objects.requireNonNull(mpvs.getPropertyValue(alias)).getValue());
                    break;
                }
            }
        }
        // 将参数绑定到父类上
        for (Field field : superFields) {
            ValueFrom valueFromAnnotation = field.getAnnotation(ValueFrom.class);
            if (mpvs.contains(field.getName()) || valueFromAnnotation == null) {
                continue;
            }
            for (String alias : valueFromAnnotation.value()) {
                if (mpvs.contains(alias)) {
                    mpvs.add(field.getName(), Objects.requireNonNull(mpvs.getPropertyValue(alias)).getValue());
                    break;
                }
            }
        }
    }
}
```

**AliasModelAttributeMethodProcessor**

重新注入`DataBinder`

```java
/**
 * 参数别名绑定processor
 *
 * @author Dale
 */
public class AliasModelAttributeMethodProcessor extends ServletModelAttributeMethodProcessor {

    private ApplicationContext applicationContext;

    public AliasModelAttributeMethodProcessor(boolean annotationNotRequired) {
        super(annotationNotRequired);
    }

    public void setApplicationContext(ApplicationContext applicationContext){
        this.applicationContext = applicationContext;
    }

    @Override
    protected void bindRequestParameters(WebDataBinder binder, NativeWebRequest request) {
        // 重新注入 databinder
        AliasDataBinder aliasDataBinder = new AliasDataBinder(binder.getTarget(), binder.getObjectName());
        RequestMappingHandlerAdapter requestMappingHandlerAdapter = applicationContext.getBean(RequestMappingHandlerAdapter.class);
        Objects.requireNonNull(requestMappingHandlerAdapter.getWebBindingInitializer()).initBinder(aliasDataBinder);
        aliasDataBinder.bind(Objects.requireNonNull(request.getNativeRequest(ServletRequest.class)));
    }
}
```


最后利用`WebMvcConfigurer.addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers)`注入`AliasModelAttributeMethodProcessor`

**WebMvcConfiguration**

```java
/**
 * web mvc 配置
 *
 * @author Dale
 */
@Component
public class WebMvcConfiguration implements WebMvcConfigurer {

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        AliasModelAttributeMethodProcessor aliasModelAttributeMethodProcessor = new AliasModelAttributeMethodProcessor(true);
        aliasModelAttributeMethodProcessor.setApplicationContext(applicationContext);
        // 注入 AliasModelAttributeMethodProcessor
        resolvers.add(aliasModelAttributeMethodProcessor);
        WebMvcConfigurer.super.addArgumentResolvers(resolvers);
    }
}
```

## 使用

在定义传入参数的时候使用注解设置别名

**RequestParam**

```java
/**
 * 发送消息必要参数
 *
 * @author baoxulong
 */
public class RequestParam {
    /**
     * name
     */
    @NotNull(message = "name is required!")
    @ValueFrom(value = "nm")
    private String name;
    
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
    
}
```

**NameController**

```java
/**
 * name 控制器
 *
 * @author Dale
 */
@RestController
@RequestMapping("name")
public class NameController {

    @PostMapping("set")
    public JsonResult set(@Valid RequestParam requestParam) {
        // todo::
        return JsonResult.success();
    }
    
}
```

## 总结

以上是 `SpringBoot` 设置参数别名的方法代码实记，深度不高，找时间再深挖。

