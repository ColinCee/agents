import software.amazon.event.ruler.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.*;
public class Run {
  public static void main(String[] a) throws Exception {
    ObjectMapper m=new ObjectMapper();
    JsonNode cases=m.readTree(Files.readString(Path.of(a[0])));
    ObjectNode out=m.createObjectNode();
    for(JsonNode c:cases){
      String r;
      try{ r=String.valueOf(Ruler.matchesRule(m.writeValueAsString(c.get("event")),m.writeValueAsString(c.get("pattern")))); }
      catch(Throwable e){ r="ERR:"+e.getClass().getSimpleName()+":"+e.getMessage(); }
      out.put(c.get("id").asText(),r);
    }
    // via Machine as well
    ObjectNode out2=m.createObjectNode();
    for(JsonNode c:cases){
      String r;
      try{ Machine mc=new Machine(); mc.addRule("r",m.writeValueAsString(c.get("pattern")));
           r=String.valueOf(!mc.rulesForJSONEvent(m.writeValueAsString(c.get("event"))).isEmpty()); }
      catch(Throwable e){ r="ERR:"+e.getClass().getSimpleName()+":"+e.getMessage(); }
      out2.put(c.get("id").asText(),r);
    }
    ObjectNode res=m.createObjectNode(); res.set("matchesRule",out); res.set("machine",out2);
    Files.writeString(Path.of(a[1]),m.writerWithDefaultPrettyPrinter().writeValueAsString(res));
  }
}
