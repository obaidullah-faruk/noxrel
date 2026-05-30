from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core import config


def setup_telemetry() -> None:
    provider = TracerProvider(resource=Resource.create({"service.name": config.SERVICE_NAME}))
    provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(
                endpoint=config.OTEL_EXPORTER_OTLP_ENDPOINT,
            )
        )
    )
    trace.set_tracer_provider(provider)


def get_tracer() -> trace.Tracer:
    return trace.get_tracer(config.SERVICE_NAME)
