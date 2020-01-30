# browser-requirifier

Yet another attempt to put commonjs modules in the browser

## Why?

I made this (and didn't use require.js) for the following reasons:

* I wanted to be able to require directories in the browser (See [`requirifier-requiredir`](https://github.com/ARitz-Cracker/requirifier-requiredir))
* I wanted sane error reports, none of that bundled single-file-javascript BS
* I wanted a way to easily load modules only for pages that needed them. None of that "Load EVERYTHING even if you're only on the home page" crap
* I wanted `__filename` and `__dirname` to work (mostly because of [`requirifier-requiredir`](https://github.com/ARitz-Cracker/requirifier-requiredir))
* I suffer from NIH syndrome

## So how do I use it?

1. Prepare
    * Note: This module expects there to be a `node_modules` folder with all your dependencies in your working-directory
    * Create a file called `browser-requirifier-config.json` in your working directory with contents following this example:
```js
{
	"moduleList": {
		// This is required!
		"main": {
			// If a directory is specified, recursion will happen
			"includedFiles": [
				"index.js",
				"lib/main",
				"lib_browser/main_page",
				// You don't need to specify a module's dependencies, that'll happen automatically. But you have to specify YOUR dependencies
				"node_modules/base_dependency"
			],
			"startPoint": "browser.js"
		},
		// This is optional, name of list can be arbitrary;
		// As long as they're url-safe and filename-safe
		"$otherList": {
			"includedFiles": [
				"some_subpage.js",
				"lib_browser/some_subpage",
				"node_modules/some_dependency",
				"node_modules/other_dependency"
			],
			"startPoint": "some_subpage.js"
		}
		// More lists can be added
	},
	// List of files/folders to ignore
	"excludedFiles": [
		"lib_node",
		"node_modules/some_dependency/lib_node"
	],
	"outputDir": "browser_exports",
	"baseURL": "/js/"
}
```
2. Execute `browser-requirifier` (assuming this is globally installed) in your working directory.
3. Observe the files placed in your `outputDir`
    * `requirifier-init.js` - Needed for everything.
	* All your files specified in your list - edited so that they can be loaded by `requirifier-init.js`
	* `requirifier-module-list-main.js` - Contains the list of modules specified in `moduleList.main.includedFiles`. `moduleList.main.startPoint` will be executed once [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/API/Window/DOMContentLoaded_event) happens.
	* `requirifier-module-list-$otherList.js` - Contains the list of modules specified in `moduleList.$otherList.includedFiles`. `moduleList.$otherList.startPoint` will be executed syncronously after `moduleList.main.startPoint`
	* Note: If you're importing loading optional lists at once, order of execution is undefined
4. Upload to your server following what you specified in `baseURL`
5. Include in your HTML as needed! 
