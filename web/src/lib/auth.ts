import { create } from "zustand";
import { getToken, setToken, setUnauthorizedHandler } from "./api/client";

interface AuthState {
	authed: boolean;
	signIn: (token: string) => void;
	signOut: () => void;
}

function signOut() {
	setToken("");
	useAuth.setState({ authed: false });
}

setUnauthorizedHandler(signOut);

// Reactive auth presence, mirrored from the api client's token storage so the
// shell can gate on it. The api client remains the source of truth for the
// token value; this store only tracks whether we are signed in.
export const useAuth = create<AuthState>((set) => ({
	authed: !!getToken(),
	signIn: (token) => {
		setToken(token);
		set({ authed: true });
	},
	signOut,
}));
