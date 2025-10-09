// Controls demo loader script: optional logging for debugging
console.log("Controls demo loaded");

function bindLog(id: string) {
	const el = document.getElementById(id) as any;
	if (!el) return;
	el.addEventListener("input", (ev: any) => {
		const d = ev.detail || {};
		console.log(id, d);
	});
}

// bindLog("ctl-keyboard-mouse");
// bindLog("ctl-left-stick");
// bindLog("ctl-right-stick");
// bindLog("ctl-gamepad-buttons");


