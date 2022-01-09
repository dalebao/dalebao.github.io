使用synchronized注意点

* 一把锁只能同时被一个线程获取，没有获取锁的线程只能等待
* 每个实力都对应有一把自己的锁（this)，不同实例之间互不影响。例外：锁对象是\*.class以及synchronized修饰static方法，所有对象公用一把锁
* synchronized修饰的方法，无论发放正常执行完毕还是抛出异常，都会释放锁

对象锁
---

包括方法锁(默认锁对象为this,当前实例对象)和同步代码块锁(自己指定锁对象) 

### 代码块形式：手动指定锁定对象，也可是是this,也可以是自定义的锁 

public class SynchronizedObjectLock implements Runnable { static SynchronizedObjectLock instence = new SynchronizedObjectLock(); @Override public void run() { // 同步代码块形式——锁为this,两个线程使用的锁是一样的,线程1必须要等到线程0释放了该锁后，才能执行 synchronized (this) { System.out.println("我是线程" + Thread.currentThread().getName()); try { Thread.sleep(3000); } catch (InterruptedException e) { e.printStackTrace(); } System.out.println(Thread.currentThread().getName() + "结束"); } } public static void main(String[] args) { Thread t1 = new Thread(instence); Thread t2 = new Thread(instence); t1.start(); t2.start(); } } 

### 方法锁形式：synchronized修饰普通方法，锁对象默认为this 

public class SynchronizedObjectLock implements Runnable { static SynchronizedObjectLock instence = new SynchronizedObjectLock(); @Override public void run() { method(); } public synchronized void method() { System.out.println("我是线程" + Thread.currentThread().getName()); try { Thread.sleep(3000); } catch (InterruptedException e) { e.printStackTrace(); } System.out.println(Thread.currentThread().getName() + "结束"); } public static void main(String[] args) { Thread t1 = new Thread(instence); Thread t2 = new Thread(instence); t1.start(); t2.start(); } }

类锁
--

指synchronize修饰静态的方法或指定锁对象为Class对象 

### synchronize修饰静态方法 

示例一：锁在非静态方法上

public class SynchronizedObjectLock implements Runnable { static SynchronizedObjectLock instence1 = new SynchronizedObjectLock(); static SynchronizedObjectLock instence2 = new SynchronizedObjectLock(); @Override public void run() { method(); } // synchronized用在普通方法上，默认的锁就是this，当前实例 public synchronized void method() { System.out.println("我是线程" + Thread.currentThread().getName()); try { Thread.sleep(3000); } catch (InterruptedException e) { e.printStackTrace(); } System.out.println(Thread.currentThread().getName() + "结束"); } public static void main(String[] args) { // t1和t2对应的this是两个不同的实例，所以代码不会串行 Thread t1 = new Thread(instence1); Thread t2 = new Thread(instence2); t1.start(); t2.start(); } }

示例二：锁在static方法上

public class SynchronizedObjectLock implements Runnable { static SynchronizedObjectLock instence1 = new SynchronizedObjectLock(); static SynchronizedObjectLock instence2 = new SynchronizedObjectLock(); @Override public void run() { method(); } // synchronized用在静态方法上，默认的锁就是当前所在的Class类，所以无论是哪个线程访问它，需要的锁都只有一把 public static synchronized void method() { System.out.println("我是线程" + Thread.currentThread().getName()); try { Thread.sleep(3000); } catch (InterruptedException e) { e.printStackTrace(); } System.out.println(Thread.currentThread().getName() + "结束"); } public static void main(String[] args) { Thread t1 = new Thread(instence1); Thread t2 = new Thread(instence2); t1.start(); t2.start(); } }

示例三：锁在class上

public class SynchronizedObjectLock implements Runnable { static SynchronizedObjectLock instence1 = new SynchronizedObjectLock(); static SynchronizedObjectLock instence2 = new SynchronizedObjectLock(); @Override public void run() { // 所有线程需要的锁都是同一把 synchronized(SynchronizedObjectLock.class){ System.out.println("我是线程" + Thread.currentThread().getName()); try { Thread.sleep(3000); } catch (InterruptedException e) { e.printStackTrace(); } System.out.println(Thread.currentThread().getName() + "结束"); } } public static void main(String[] args) { Thread t1 = new Thread(instence1); Thread t2 = new Thread(instence2); t1.start(); t2.start(); } }