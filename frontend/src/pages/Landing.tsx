import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { Categories } from "@/components/landing/Categories";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Trust } from "@/components/landing/Trust";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

function Landing() {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) {
		return null;
	}

	if (isAuthenticated) {
		return (
			<Navigate
				to="/home"
				replace
			/>
		);
	}

	return (
		<main className="pt-navbar">
			<Hero />
			<Stats />
			<Categories />
			<HowItWorks />
			<Trust />
		</main>
	);
}

export { Landing };