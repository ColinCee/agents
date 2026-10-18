import software.amazon.event.ruler.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.Consumer;

/** Tiny in-process EventBridge-like bus: event-ruler routes, handlers are local functions, faults injectable. */
public class Proto {
  static class Faults { double dupProb=0, reorderProb=0; long delayMs=0; Random rnd=new Random(42); }
  static class Bus {
    final Machine machine=new Machine();
    final Map<String,Consumer<String>> targets=new ConcurrentHashMap<>();
    final ScheduledExecutorService sched=Executors.newScheduledThreadPool(2);
    final Faults f; String held=null; // reorder buffer: one event held back, released after the next one
    Bus(Faults f){this.f=f;}
    void rule(String name,String pattern,Consumer<String> handler) throws Exception { machine.addRule(name,pattern); targets.put(name,handler); }
    synchronized void put(String eventJson) throws Exception {
      for(String r: machine.rulesForJSONEvent(eventJson)) deliver(r,eventJson);
    }
    void deliver(String rule,String ev){
      Consumer<String> h=targets.get(rule);
      if(f.reorderProb>0 && f.rnd.nextDouble()<f.reorderProb){ // hold this one, release the previously held one after it
        String prev=held; held=ev; if(prev!=null) run(h,prev); return; }
      run(h,ev);
      if(held!=null){ String p=held; held=null; run(h,p); }
      if(f.dupProb>0 && f.rnd.nextDouble()<f.dupProb) run(h,ev); // at-least-once duplicate
    }
    void run(Consumer<String> h,String ev){ if(f.delayMs>0) sched.schedule(()->h.accept(ev),f.delayMs,TimeUnit.MILLISECONDS); else h.accept(ev); }
  }
  static String ev(int i){ return "{\"source\":\"app\",\"detail-type\":\"order.created\",\"detail\":{\"seq\":"+i+",\"amount\":"+(i%100)+"}}"; }
  public static void main(String[] a) throws Exception {
    long jvmStart=System.nanoTime();
    // Phase 1: cold path: build bus, 1 rule, 1 event, measure time to first handler call (inside this JVM)
    long t0=System.nanoTime();
    Faults none=new Faults(); Bus bus=new Bus(none);
    CountDownLatch first=new CountDownLatch(1);
    bus.rule("r1","{\"source\":[\"app\"],\"detail\":{\"amount\":[{\"numeric\":[\">=\",50]}]}}",e->first.countDown());
    bus.put(ev(75)); first.await();
    System.out.printf("COLD in-JVM: construct bus + addRule + first event delivered = %.1f ms%n",(System.nanoTime()-t0)/1e6);
    System.out.printf("COLD JVM uptime at first delivery = %d ms (JVM boot not included in the line above)%n", java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime());
    // Phase 2: steady-state latency put()->handler, 50k events, no faults
    int N=50000; long[] lat=new long[N]; AtomicInteger idx=new AtomicInteger();
    Bus b2=new Bus(none); b2.rule("r","{\"source\":[\"app\"],\"detail-type\":[\"order.created\"]}",e->{});
    // handler measures its own latency via thread-local start
    ThreadLocal<Long> st=new ThreadLocal<>();
    Bus b3=new Bus(none); b3.rule("r","{\"source\":[\"app\"],\"detail-type\":[\"order.created\"]}",e->{lat[idx.getAndIncrement()]=System.nanoTime()-st.get();});
    for(int w=0;w<5000;w++){st.set(System.nanoTime());b3.put(ev(w));} idx.set(0);
    for(int i=0;i<N;i++){st.set(System.nanoTime());b3.put(ev(i));}
    long[] s=lat.clone(); Arrays.sort(s);
    System.out.printf("STEADY put->handler latency (N=%d): p50=%.1f us p99=%.1f us max=%.1f us%n",N,s[N/2]/1e3,s[(int)(N*.99)]/1e3,s[N-1]/1e3);
    // Phase 3: fault injection correctness
    Faults f=new Faults(); f.dupProb=0.2; f.reorderProb=0.3; Bus b4=new Bus(f);
    List<Integer> seen=Collections.synchronizedList(new ArrayList<>());
    b4.rule("r","{\"source\":[\"app\"]}",e->{ int p=e.indexOf("\"seq\":")+6; seen.add(Integer.parseInt(e.substring(p,e.indexOf(',',p)))); });
    for(int i=0;i<1000;i++) b4.put(ev(i));
    Set<Integer> uniq=new HashSet<>(seen); int inv=0; for(int i=1;i<seen.size();i++) if(seen.get(i)<seen.get(i-1)) inv++;
    System.out.printf("FAULTS dup=0.2 reorder=0.3: sent=1000 delivered=%d unique=%d duplicates=%d out-of-order-adjacent-pairs=%d%n",seen.size(),uniq.size(),seen.size()-uniq.size(),inv);
    Faults fd=new Faults(); fd.delayMs=50; Bus b5=new Bus(fd); long[] d=new long[1]; CountDownLatch l=new CountDownLatch(1);
    b5.rule("r","{\"source\":[\"app\"]}",e->{d[0]=System.nanoTime();l.countDown();});
    long ts=System.nanoTime(); b5.put(ev(1)); l.await();
    System.out.printf("FAULTS delay=50ms: observed put->handler = %.1f ms%n",(d[0]-ts)/1e6);
    // Phase 4: fan-out with 1000 rules
    Bus b6=new Bus(none); AtomicInteger hits=new AtomicInteger();
    for(int i=0;i<1000;i++) b6.rule("r"+i,"{\"source\":[\"app\"],\"detail\":{\"amount\":["+(i%100)+"]}}",e->hits.incrementAndGet());
    long t=System.nanoTime(); for(int i=0;i<20000;i++) b6.put(ev(i)); double sec=(System.nanoTime()-t)/1e9;
    System.out.printf("FANOUT 1000 rules, 20000 events: %.0f events/sec, %d handler calls (expected 200000)%n",20000/sec,hits.get());
    System.exit(0);
  }
}
