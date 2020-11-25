// These snippets of code return true if the polyfill is required
module.exports = {
	// Firefox (As of v83) doesn't support native dialogs
	"dialog-element": "return typeof document.createElement(\"dialog\").showModal !== \"function\"",
	// Safari Desktop (As of v14) doesn't support date or time elements
	"input-date-element": "try{" +
		"const e = document.createElement(\"input\");" +
		"e.type = \"date\";" +
		"e.value = \"1999-12-31\";" +
		"e.stepUp();" +
		"return e.value !== \"2000-01-01\";" +
		"}catch(ex){return true;}",
	"input-time-element": "try{" +
		"const e = document.createElement(\"input\");" +
		"e.type = \"time\";" +
		"e.value = \"10:59\";" +
		"e.stepUp();" +
		"return e.value !== \"11:00\";" +
		"}catch(ex){return true;}"
}
