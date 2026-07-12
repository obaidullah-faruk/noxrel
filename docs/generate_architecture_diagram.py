"""
Generate the Noxrel K8s architecture PNG (mingrammer/diagrams + Graphviz).

Board style: nested AWS → VPC → public/private → Kubernetes.
K8s uses nginx Ingress (Kong is Compose-only per README).
Observability at the top. Orthogonal edges; xlabel keeps text near edges.

Requires:
  pip install diagrams pillow && brew install graphviz

Run:
  python docs/generate_architecture_diagram.py
"""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.analytics import ManagedStreamingForKafka
from diagrams.aws.compute import ECR, EKS
from diagrams.aws.database import DocumentDB, ElastiCache, RDS
from diagrams.aws.network import ALB, CloudFront, Route53
from diagrams.aws.security import CertificateManager, SecretsManager, WAF
from diagrams.aws.storage import S3
from diagrams.elastic.elasticsearch import Elasticsearch, Kibana
from diagrams.elastic.observability import APM
from diagrams.generic.blank import Blank
from diagrams.generic.device import Mobile
from diagrams.onprem.client import Client, Users
from diagrams.onprem.gitops import Argocd
from diagrams.onprem.logging import FluentBit
from diagrams.onprem.monitoring import Grafana, Prometheus
from diagrams.onprem.network import Nginx
from diagrams.onprem.tracing import Jaeger
from diagrams.onprem.vcs import Github
from diagrams.programming.framework import Django, FastAPI, Nextjs
from diagrams.programming.language import Nodejs, Python
from diagrams.saas.payment import Stripe
from PIL import Image, ImageDraw

OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_NAME = "architecture"
OUTPUT_PNG = OUTPUT_DIR / f"{OUTPUT_NAME}.png"

AWS_BOX = {
    "bgcolor": "#F4F6F7",
    "pencolor": "#232F3E",
    "penwidth": "2.4",
    "style": "rounded",
    "margin": "24",
    "fontsize": "15",
    "fontcolor": "#232F3E",
}
VPC_BOX = {
    "bgcolor": "#D6EAF8",
    "pencolor": "#1F618D",
    "penwidth": "2.1",
    "style": "rounded",
    "margin": "18",
    "fontsize": "13",
    "fontcolor": "#1A5276",
}
PUBLIC_BOX = {
    "bgcolor": "#D5F5E3",
    "pencolor": "#196F3D",
    "penwidth": "1.6",
    "style": "rounded",
    "margin": "14",
    "fontsize": "12",
    "fontcolor": "#145A32",
}
PRIVATE_BOX = {
    "bgcolor": "#D4E6F1",
    "pencolor": "#1A5276",
    "penwidth": "1.6",
    "style": "rounded",
    "margin": "14",
    "fontsize": "12",
    "fontcolor": "#1A5276",
}
K8S_BOX = {
    "bgcolor": "#EBD4EF",
    "pencolor": "#6C3483",
    "penwidth": "1.7",
    "style": "rounded",
    "margin": "12",
    "fontsize": "12",
    "fontcolor": "#4A235A",
}
GROUP = {
    "bgcolor": "#FFFFFF",
    "pencolor": "#ABB2B9",
    "penwidth": "1.1",
    "style": "rounded",
    "margin": "10",
    "fontsize": "11",
    "fontcolor": "#2C3E50",
}
SIDE = {
    "bgcolor": "#FBFCFC",
    "pencolor": "#7F8C8D",
    "penwidth": "1.4",
    "style": "rounded",
    "margin": "14",
    "fontsize": "12",
    "fontcolor": "#2C3E50",
}


def box(label: str, style: dict):
    return Cluster(label, graph_attr=style)


def row(*nodes):
    for a, b in zip(nodes, nodes[1:]):
        a >> Edge(style="invis") >> b


def edge(text: str | None = None, **attrs):
    """Orthogonal-friendly edge: xlabel sits beside the line, not mid-route."""
    if text:
        return Edge(xlabel=text, **attrs)
    return Edge(**attrs)


def flatten_to_board(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    canvas = Image.new("RGBA", (w, h), (245, 247, 250, 255))
    draw = ImageDraw.Draw(canvas)
    grid = (228, 232, 238, 255)
    step = 40
    for x in range(0, w, step):
        draw.line([(x, 0), (x, h)], fill=grid, width=1)
    for y in range(0, h, step):
        draw.line([(0, y), (w, y)], fill=grid, width=1)
    canvas.alpha_composite(img)
    canvas.convert("RGB").save(path, "PNG")


def main() -> None:
    graph_attr = {
        "fontsize": "22",
        "fontname": "Helvetica",
        "bgcolor": "transparent",
        "pad": "0.85",
        "nodesep": "0.75",
        "ranksep": "1.05",
        "splines": "ortho",
        "concentrate": "false",
        "margin": "0.4",
        "dpi": "150",
    }
    node_attr = {
        "fontsize": "11",
        "fontname": "Helvetica",
        "height": "1.4",
        "width": "1.4",
        "margin": "0.16",
    }
    edge_attr = {
        "fontsize": "9",
        "fontname": "Helvetica",
        "labelfontsize": "9",
        "minlen": "2",
    }

    api = {"color": "#1C2833", "penwidth": "1.7"}
    media = {"color": "#0B5345", "style": "dashed", "penwidth": "1.8"}
    events = {"color": "#5B2C6F", "style": "dashed", "penwidth": "1.6"}
    rtmp_e = {"color": "#922B21", "style": "dashed", "penwidth": "1.6"}
    saas = {"color": "#9B2335", "style": "dashed", "penwidth": "1.5"}
    git = {"color": "#1A5276", "penwidth": "1.4"}
    tele = {"color": "#B9770E", "style": "dotted", "penwidth": "1.4"}

    with Diagram(
        "Noxrel — Video Streaming Platform (Kubernetes)",
        filename=str(OUTPUT_DIR / OUTPUT_NAME),
        outformat="png",
        show=False,
        direction="LR",
        graph_attr=graph_attr,
        node_attr=node_attr,
        edge_attr=edge_attr,
    ):
        with box("Clients", SIDE):
            viewers = Users("Viewers")
            admins = Client("Admins")
            mobile = Mobile("Mobile")
            encoder = Blank("OBS /\nencoder")
            row(viewers, mobile)
            row(admins, encoder)

        with box("Frontends", SIDE):
            web_user = Nextjs("web-user\nNext.js")
            web_admin = Nextjs("web-admin\nNext.js")
            row(web_user, web_admin)

        with box("CI / GitOps", SIDE):
            github = Github("GitHub\nmonorepo")
            argocd = Argocd("Argo CD")
            row(github, argocd)

        viewers >> edge("HTTPS", **api) >> web_user
        mobile >> edge("HTTPS", **api) >> web_user
        admins >> edge("HTTPS", **api) >> web_admin

        with box("AWS Cloud", AWS_BOX):
            # Real stack from infrastructure/docker-compose.infra.yml
            with box("Observability", SIDE):
                fluent = FluentBit("Fluent Bit\nlogs")
                otel = Blank("OTel\nCollector")
                prom = Prometheus("Prometheus\nmetrics")
                grafana = Grafana("Grafana")
                jaeger = Jaeger("Jaeger\ntraces")
                kibana = Kibana("Kibana")
                apm = APM("Elastic APM")
                row(fluent, otel, prom, grafana)
                row(jaeger, kibana, apm)

            with box("Global edge", SIDE):
                dns = Route53("Route 53")
                cdn = CloudFront("CloudFront\nsigned HLS")
                acm = CertificateManager("ACM")
                ecr = ECR("ECR")
                secrets = SecretsManager("Secrets\nManager")
                row(dns, cdn, acm)
                row(ecr, secrets)

            github >> edge("build → push", **git) >> ecr
            github >> edge("manifests", **git) >> argocd

            with box("VPC", VPC_BOX):
                with box("Public subnet", PUBLIC_BOX):
                    waf = WAF("AWS WAF")
                    alb = ALB("ALB")
                    row(waf, alb)

                with box("Private subnet", PRIVATE_BOX):
                    with box("Kubernetes Cluster", K8S_BOX):
                        k8s = EKS("Kubernetes\ncontrol plane +\nnode groups")

                        with box("Ingress", GROUP):
                            ingress = Nginx(
                                "nginx Ingress\npath routing · CORS\nWebSocket"
                            )

                        with box("Microservices", GROUP):
                            user_svc = Django(
                                "user-service\nDjango REST\nauth · RBAC · JWT"
                            )
                            video_svc = Django(
                                "video-service\nDjango REST\ncatalog · upload"
                            )
                            streaming_svc = Nodejs(
                                "streaming-service\nFastify\nHLS / ABR"
                            )
                            live_svc = Nodejs("live-service\nFastify\nlive + chat")
                            social_svc = FastAPI(
                                "social-service\nFastAPI\ncomments · ratings"
                            )
                            billing_svc = FastAPI(
                                "billing-service\nFastAPI\nsubscriptions"
                            )
                            search_svc = FastAPI("search-service\nFastAPI\nfull-text")
                            notify_svc = FastAPI(
                                "notification-service\nFastAPI\nemail · push"
                            )
                            ai_svc = FastAPI("ai-service\nFastAPI\nchatbot · NL search")
                            row(user_svc, video_svc, streaming_svc, live_svc)
                            row(social_svc, billing_svc, search_svc, notify_svc, ai_svc)

                        with box("Media pipeline", GROUP):
                            rtmp = Nginx("nginx-rtmp\nRTMP ingest")
                            transcode = Python("transcode-worker\nPython + FFmpeg")
                            row(rtmp, transcode)

                        argocd >> edge("deploy", **git) >> k8s
                        ecr >> edge("pull images", **git) >> k8s
                        secrets >> edge("inject secrets", **git) >> k8s
                        k8s >> Edge(style="invis") >> ingress
                        ingress >> Edge(style="invis") >> user_svc
                        user_svc >> Edge(style="invis") >> social_svc
                        video_svc >> Edge(style="invis") >> transcode
                        live_svc >> edge("control", **api) >> rtmp

                with box("Private subnet — data", PRIVATE_BOX):
                    kafka = ManagedStreamingForKafka(
                        "MSK (Kafka)\n"
                        "user.registered\n"
                        "video.uploaded / video.transcoded\n"
                        "payment.* · live.* · comment.*"
                    )
                    rds = RDS("RDS PostgreSQL\nper-service DBs")
                    redis = ElastiCache("ElastiCache\nRedis")
                    docdb = DocumentDB("DocumentDB\nMongo-compatible")
                    elastic = Elasticsearch("Elasticsearch\nsearch · logs · APM")
                    row(kafka, rds, redis)
                    row(docdb, elastic)

            with box("Object storage", SIDE):
                s3 = S3("S3\nraw-videos\ntranscoded-videos\nthumbnails")

        with box("External", SIDE):
            stripe = Stripe("Stripe")
            claude = Blank("Claude API")
            mail = Blank("SES / FCM")
            row(stripe, claude, mail)

        # ── Highways (short xlabels; spacing avoids overlaps) ────────────

        web_user >> edge("API", **api) >> dns
        web_admin >> edge("API", **api) >> dns
        dns >> edge(**api) >> waf
        acm >> Edge(style="invis") >> dns
        waf >> edge("TLS", **api) >> alb
        (
            alb
            >> edge(
                "/auth /videos /stream\n/live /billing /social\n/search /ai",
                **api,
            )
            >> ingress
        )

        admins >> edge("presigned upload", **media) >> s3
        video_svc >> edge("presign / complete", **media) >> s3
        transcode >> edge("write HLS", **media) >> s3
        streaming_svc >> edge("manifest URLs", **media) >> cdn
        web_user >> edge("play", **media) >> cdn
        cdn >> edge("origin", **media) >> s3

        encoder >> edge("RTMP", **rtmp_e) >> rtmp

        # Numbered video pipeline (topics also listed on Kafka node)
        video_svc >> edge("1 uploaded", **events) >> kafka
        kafka >> edge("2 consume", **events) >> transcode
        transcode >> edge("3 transcoded", **events) >> kafka
        kafka >> edge("4 catalog ready", **events) >> video_svc
        user_svc >> edge("user.registered", **events) >> kafka
        kafka >> edge("billing · notify · search", **events) >> billing_svc
        billing_svc >> Edge(style="invis") >> notify_svc
        notify_svc >> Edge(style="invis") >> search_svc

        # Distinct SQL labels so they do not pile on one string
        user_svc >> edge("user SQL", **api) >> rds
        video_svc >> edge("video SQL", **api) >> rds
        billing_svc >> edge("billing SQL", **api) >> rds
        user_svc >> edge("RBAC cache", **api) >> redis
        streaming_svc >> edge("sessions", **api) >> redis
        social_svc >> edge("comments", **api) >> docdb
        live_svc >> edge("chat", **api) >> docdb
        search_svc >> edge("search index", **api) >> elastic

        billing_svc >> edge("checkout", **saas) >> stripe
        stripe >> edge("webhooks", **saas) >> billing_svc
        ai_svc >> edge("LLM", **saas) >> claude
        notify_svc >> edge("email / push", **saas) >> mail

        # Observability wiring (matches infra: Fluent Bit, OTel, ES, APM, …)
        k8s >> edge("container logs", **tele) >> fluent
        fluent >> edge("ship logs", **tele) >> elastic
        k8s >> edge("OTLP", **tele) >> otel
        otel >> edge("traces", **tele) >> jaeger
        otel >> edge("metrics", **tele) >> prom
        otel >> edge("APM export", **tele) >> apm
        apm >> edge(**tele) >> elastic
        prom >> edge(**tele) >> grafana
        elastic >> edge(**tele) >> kibana

    flatten_to_board(OUTPUT_PNG)
    print(f"Wrote {OUTPUT_PNG}")


if __name__ == "__main__":
    main()
