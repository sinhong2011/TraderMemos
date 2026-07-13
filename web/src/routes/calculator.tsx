import { createFileRoute } from "@tanstack/react-router";
import { RCalculatorView } from "../app/screens/RCalculatorView";

export const Route = createFileRoute("/calculator")({
	component: CalculatorPage,
});

function CalculatorPage() {
	return <RCalculatorView />;
}
