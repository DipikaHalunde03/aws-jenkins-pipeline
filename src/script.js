const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Pipeline simulator ---------- */
const stages = [
  { name: "Commit", tool: "GitHub", logs: ["git push origin main", "Webhook received by Jenkins"] },
  { name: "Build", tool: "Docker", logs: ["docker build -t aws-devops-webapp:42 .", "Step 3/4 : COPY . /usr/share/nginx/html", "Successfully built image"] },
  { name: "Test", tool: "Jenkins", logs: ["docker run -d -p 8081:80 aws-devops-webapp:42", "curl -f http://localhost:8081", "HTTP 200 OK, page served"] },
  { name: "Push", tool: "Amazon ECR", logs: ["aws ecr get-login-password | docker login", "docker push <account>.dkr.ecr.<region>.amazonaws.com/aws-devops-webapp:42", "digest: sha256:9f2c… pushed"] },
  { name: "Deploy", tool: "Amazon ECS", logs: ["aws ecs update-service --force-new-deployment", "Starting task on Fargate…", "Task is RUNNING"] },
  { name: "Verify", tool: "Health check", logs: ["curl -f http://<task-public-ip>", "HTTP 200 OK", "Deployment stable"] },
];

const track = $("track"), crate = $("crate"), log = $("log"), result = $("result"), runBtn = $("run");
const nodes = stages.map((s) => {
  const el = document.createElement("div");
  el.className = "stage";
  el.innerHTML = `${s.name}<small>${s.tool}</small>`;
  track.appendChild(el);
  return el;
});

const place = (i) => crate.style.setProperty("--pos", (i + 0.5) / stages.length);
place(0);

function print(text, cls) {
  const line = document.createElement("span");
  if (cls) line.className = cls;
  line.textContent = text + "\n";
  log.appendChild(line);
  log.parentElement.scrollTop = log.parentElement.scrollHeight;
}

async function typeLine(text, cls) {
  const line = document.createElement("span");
  if (cls) line.className = cls;
  log.appendChild(line);
  for (const ch of text) {
    line.textContent += ch;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) await sleep(10);
  }
  line.textContent += "\n";
  log.parentElement.scrollTop = log.parentElement.scrollHeight;
}

async function run() {
  runBtn.disabled = true;
  log.textContent = "";
  result.textContent = "";
  result.style.color = "";
  crate.className = "crate";
  nodes.forEach((n) => (n.className = "stage"));
  place(0);
  const fail = $("fail").checked;

  for (let i = 0; i < stages.length; i++) {
    nodes[i].classList.add("active");
    place(i);
    await sleep(900);
    print(`── ${stages[i].name} (${stages[i].tool})`, "cmd-t");

    for (const l of stages[i].logs) {
      if (fail && stages[i].name === "Test" && l.startsWith("curl")) {
        await typeLine(l);
        await typeLine("curl: (22) HTTP 404, index.html not found", "err-t");
        await typeLine("Pipeline failed at Test. Nothing was pushed, nothing was deployed.", "err-t");
        nodes[i].className = "stage error";
        crate.classList.add("error");
        result.textContent = "Failed safely: a broken build never reaches ECR or ECS.";
        result.style.color = "var(--coral)";
        runBtn.disabled = false;
        return;
      }
      await typeLine(l.startsWith("$") ? l : "$ " + l, l.startsWith("HTTP") || l.includes("RUNNING") || l.includes("pushed") || l.includes("Success") || l.includes("stable") ? "ok-t" : "");
      await sleep(200);
    }
    nodes[i].className = "stage done";
  }
  crate.classList.add("ok");
  result.textContent = "Live. Your commit is running on ECS.";
  result.style.color = "var(--green)";
  runBtn.disabled = false;
}
runBtn.addEventListener("click", run);

/* ---------- Tier explorer ---------- */
const tiers = [
  { name: "Presentation", title: "What users see", tech: "HTML, CSS, JavaScript (or React later)", aws: "Nginx container on ECS, or S3 + CloudFront", cost: "A few cents per hour on Fargate", live: true },
  { name: "Application", title: "Where the rules live", tech: "Node.js or Java REST API", aws: "ECS service (or EKS as an advanced step)", cost: "Another Fargate task while it runs", live: false },
  { name: "Data", title: "Where information is stored", tech: "MySQL or PostgreSQL", aws: "Amazon RDS in a private subnet", cost: "Billed per hour, delete it after the demo", live: false },
];
const tabs = $("tabs"), panel = $("panel");
function showTier(i) {
  [...tabs.children].forEach((b, j) => b.setAttribute("aria-selected", i === j));
  const t = tiers[i];
  panel.innerHTML = `<h3>${t.title}</h3>
    <dl><dt>Technology</dt><dd>${t.tech}</dd><dt>On AWS</dt><dd>${t.aws}</dd><dt>Cost</dt><dd>${t.cost}</dd></dl>
    <span class="status ${t.live ? "live" : "next"}">${t.live ? "Built in this project" : "Next project"}</span>`;
  panel.style.animation = "none"; panel.offsetWidth; panel.style.animation = "";
}
tiers.forEach((t, i) => {
  const b = document.createElement("button");
  b.role = "tab"; b.textContent = `${i + 1}. ${t.name}`;
  b.onclick = () => showTier(i);
  tabs.appendChild(b);
});
showTier(0);

/* ---------- Cost estimator (approximate us-east-1 prices) ---------- */
const RATE = 0.25 * 0.04048 + 0.5 * 0.004445 + 0.005; // vCPU + GB + public IPv4, per hour
const hrs = $("hrs");
function cost() {
  const h = +hrs.value;
  $("hrsOut").textContent = h + (h === 1 ? " hour" : " hours");
  $("cost").textContent = "$" + (h * RATE).toFixed(2);
  $("forgot").textContent = "$" + (720 * RATE).toFixed(2);
}
hrs.addEventListener("input", cost);
cost();

/* ---------- Cleanup checklist (saved in this browser) ---------- */
const items = [
  "Set ECS service desired count to 0, then delete it",
  "Delete the ECS cluster",
  "Check for load balancers and delete them",
  "Check every VPC for NAT gateways",
  "Release unused Elastic IP addresses",
  "Delete the ECR repository and images",
  "Delete lab-only VPC, subnets and security groups",
  "Delete the pipeline IAM access keys",
];
let saved = [];
try { saved = JSON.parse(localStorage.getItem("cleanup") || "[]"); } catch (e) {}
const list = $("check");
items.forEach((text, i) => {
  const li = document.createElement("li");
  li.innerHTML = `<label><input type="checkbox"><span>${text}</span></label>`;
  const box = li.querySelector("input");
  box.checked = !!saved[i];
  box.addEventListener("change", () => {
    saved[i] = box.checked;
    try { localStorage.setItem("cleanup", JSON.stringify(saved)); } catch (e) {}
    progress();
  });
  list.appendChild(li);
});
function progress() {
  const done = [...list.querySelectorAll("input")].filter((b) => b.checked).length;
  $("barFill").style.width = (done / items.length) * 100 + "%";
  $("cleanMsg").textContent = done === items.length
    ? "All clean. You should not be paying for anything now."
    : `${done} of ${items.length} done. Finish all of them before you close the console.`;
}
progress();
