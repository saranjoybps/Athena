from typing import Any, Protocol


class MessagePort(Protocol):
    def send(self, to: str, template: str, payload: dict[str, Any]) -> dict[str, Any]: ...


class NoopPort:
    def send(self, to: str, template: str, payload: dict[str, Any]) -> dict[str, Any]:
        return {"status": "noop", "to": to, "template": template}


whatsapp = NoopPort()
email = NoopPort()
sms = NoopPort()


class AiPort(Protocol):
    def draft(self, kind: str, input_text: str) -> dict[str, Any]: ...


class NoopAi:
    def draft(self, kind: str, input_text: str) -> dict[str, Any]:
        return {
            "kind": kind,
            "status": "draft",
            "requiresConfirmation": True,
            "output": {},
            "sourceText": input_text,
        }


ai = NoopAi()
