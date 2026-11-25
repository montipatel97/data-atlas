(function(){"use strict";let t=null,o=[];async function a(s){if(t)return;t=await(await import(`${s}pyodide.mjs`)).loadPyodide({indexURL:s,stdout:()=>{},stderr:()=>{}}),t.setStdout({batched:r=>{o.push(r)}}),t.setStderr({batched:r=>{o.push(r)}})}const c=`
import json, traceback

def __atlas_run(user_code, check_json):
    check = json.loads(check_json) if check_json else None
    ns = {"__name__": "__main__"}
    try:
        exec(compile(user_code, "solution.py", "exec"), ns)
    except BaseException:
        return json.dumps({"error": traceback.format_exc(limit=-3)})
    if not check:
        return json.dumps({"tests": []})
    ref = {"__name__": "__ref__"}
    if check.get("solution"):
        exec(compile(check["solution"], "reference.py", "exec"), ref)
    def norm(v):
        if check.get("unordered") and isinstance(v, (list, tuple, set)):
            return sorted(repr(x) for x in v)
        if isinstance(v, float):
            return round(v, 6)
        return v
    results = []
    for t in check["tests"]:
        row = {"call": t["call"], "hidden": bool(t.get("hidden"))}
        try:
            want = eval(t["expected"], {}) if t.get("expected") else eval(t["call"], ref)
            row["expected"] = repr(want)
        except BaseException as e:
            row.update(ok=False, expected="?", got="", error="Reference failed: " + repr(e))
            results.append(row)
            continue
        try:
            got = eval(t["call"], ns)
            row["got"] = repr(got)
            row["ok"] = norm(got) == norm(want)
        except BaseException as e:
            row.update(ok=False, got="", error=type(e).__name__ + ": " + str(e))
        results.append(row)
    return json.dumps({"tests": results})
`;async function i(s,e){if(!t)throw new Error("Python is not loaded yet");o=[];const r=performance.now();t.globals.get("__atlas_run")||await t.runPythonAsync(c),t.globals.set("__atlas_code",s),t.globals.set("__atlas_check",e?JSON.stringify(e):"");const l=await t.runPythonAsync("__atlas_run(__atlas_code, __atlas_check)"),n=JSON.parse(l);return{stdout:o.join(`
`),error:n.error,tests:n.tests??[],ms:Math.round(performance.now()-r)}}self.onmessage=async s=>{const e=s.data;try{e.kind==="init"?(await a(e.indexURL),self.postMessage({id:e.id,ok:!0})):self.postMessage({id:e.id,ok:!0,result:await i(e.code,e.check)})}catch(r){self.postMessage({id:e.id,ok:!1,error:r instanceof Error?r.message:String(r)})}}})();
