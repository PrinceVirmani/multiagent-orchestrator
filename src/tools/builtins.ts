import { defineTool } from "./index.js";
import { settings } from "../config.js";

function calc(input : string): number {
    const s = input.replace(/\s+/g, "");
    let i=0;
    const peek = () => s[i];

    function parseExpr(): number{
        let v= parseTerm();
        while(peek()==="+" || peek() === "-"){
            const op = s[i++];
            const r = parseTerm();
            v = op === "+" ? v + r : v-r;
        }
        return v;
    }

    function parseTerm(): number{
        let v = parseFactor();
        while(peek()==="*" || peek() === "/" || peek() === "%"){
            const op = s[i++];
            const r = parseFactor();
            v = op === "*" ? v * r : op === "/" ? v / r : v % r; 
        }
        return v;
    }

    function parseFactor(): number{
        if(peek() === "("){
            i++;
            const v = parseExpr();
            if(s [i] === ")") i++;
            return v;
        }

        if(peek() === "+") { i++; return parseFactor();}
        if(peek() === "-") { i++; return -parseFactor();}

        return parseNumber();
          
    }

    function parseNumber(): number {
        const start = i;
        while( i < s.length && /[0-9.]/.test(s[i])) i++;
        const n = Number(s.slice(start, i));

        if(Number.isNaN(n)) throw new Error(`Invalid number near position ${start}`);
        return n;
    }

    const result = parseExpr();
    if(i != s.length) throw new Error("Unexpected trailing characters");
    return result;
}

defineTool({
  name: "calculator",
  description:
    'Evaluate a basic arithmetic expression such as "2 * (3 + 4)". Supports + - * / % and parentheses.',
  parameters: {
    type: "object",
    properties: {
      expression: { type: "string", description: "The arithmetic expression to evaluate." },
    },
    required: ["expression"],
  },
  handlers: ({ expression }) => String(calc(expression)),
});

defineTool({
  name: "web_fetch",
  description:
    "Fetch a URL with an HTTP GET and return the response body, truncated to about 4000 characters.",
  parameters: {
    type: "object",
    properties: { url: { type: "string", description: "The URL to fetch." } },
    required: ["url"],
  },
  handlers: async ({ url }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), settings.REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch(url, { redirect: "follow", signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.text()).slice(0, 4000);
    } finally {
      clearTimeout(timer);
    }
  },
});


defineTool({
  name: "now",
  description: "Return the current UTC time in ISO 8601 format.",
  parameters: { type: "object", properties: {}, required: [] },
  handlers: () => new Date().toISOString(),
})