import software.amazon.event.ruler.*;
import java.util.*;
public class Bench {
  public static void main(String[] a) throws Exception {
    int[] ruleCounts=Arrays.stream(a[0].split(",")).mapToInt(Integer::parseInt).toArray();
    String[] types={"order.created","order.paid","user.signup","user.deleted","pay.failed"};
    for(int nr:ruleCounts){
      Machine m=new Machine();
      long t0=System.nanoTime();
      for(int i=0;i<nr;i++){
        String p=a.length>2 ? "{\"source\":[\"app"+(i%50)+"\"],\"detail-type\":[\""+types[i%5]+"\"],\"detail\":{\"region\":[\"us-"+(i%5)+"\"],\"orderId\":[{\"prefix\":\"o"+i+"-\"}]}}" : "{\"source\":[\"app"+(i%50)+"\"],\"detail-type\":[{\"prefix\":\""+types[i%5].substring(0,5)+"\"}],\"detail\":{\"amount\":[{\"numeric\":[\">\","+(i%1000)+"]}],\"region\":[{\"anything-but\":\"eu-"+(i%7)+"\"}],\"ip\":[{\"cidr\":\"10."+(i%255)+".0.0/16\"}]}}";
        m.addRule("r"+i,p);
      }
      double buildMs=(System.nanoTime()-t0)/1e6;
      String[] events=new String[1000];
      Random r=new Random(1);
      for(int i=0;i<events.length;i++)
        events[i]="{\"source\":\"app"+r.nextInt(50)+"\",\"detail-type\":\""+types[r.nextInt(5)]+"\",\"detail\":{\"amount\":"+r.nextInt(2000)+",\"region\":\"us-"+r.nextInt(5)+"\",\"ip\":\"10."+r.nextInt(255)+".1.1\",\"tags\":[\"a\",\"b\"],\"pad\":\"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\"}}";
      long matches=0;
      for(int w=0;w<2000;w++) matches+=m.rulesForJSONEvent(events[w%1000]).size(); // warmup (JIT)
      int N=Integer.parseInt(a[1]); matches=0;
      long t1=System.nanoTime();
      for(int w=0;w<N;w++) matches+=m.rulesForJSONEvent(events[w%1000]).size();
      double s=(System.nanoTime()-t1)/1e9;
      System.out.printf("rules=%d build=%.0fms events/sec=%.0f avgMatchesPerEvent=%.2f%n",nr,buildMs,N/s,matches/(double)N);
    }
  }
}
