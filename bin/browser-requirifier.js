#!/usr/bin/env node
const fs = require("fs");
const fsp = fs.promises;
const {generateFileList} = require("../lib/file-finder");
const polyfillTests = require("../lib/polyfill-tests");
const path = require("path");
const util = require("util");

const removeDirectoryContents = async function(dir){
	const files = await fsp.readdir(dir);
	for(let i = 0; i < files.length; i += 1){
		try{
			await fsp.unlink(dir + path.sep + files[i]);
		}catch(ex){
			if(ex.code !== "EISDIR" && ex.code !== "EPERM"){
				throw ex;
			}
			await removeDirectoryContents(dir + path.sep + files[i]);
			await fsp.rmdir(dir + path.sep + files[i]);
		}
	}
}
const writeAndWait = async function(stream, data){
	return new Promise((resolve, reject) => {
		if(stream.write(data)){
			resolve();
		}else{
			stream.once("error", reject);
			stream.once("drain", () => {
				stream.off("error", reject);
				resolve();
			});
		}
	});
}
const addModuleDefinition = function(stream, o){
	return writeAndWait(stream, "\t" + JSON.stringify(o, null, "\t").replace(/\n/g, "\n\t") + ",\n")
}
const stringEscapeSquences = function(str){
	return str
		.replace(/\\/g, "\\\\")
		.replace(/\"/g, "\\\"")
		.replace(/[\x00-\x1f]/g, (match) => {
			// Not anyone would do this, but file names can contain control characters in Linux
			return "\\x" + match.charCodeAt(0).toString(16).padStart(2, "0");
		});
}
const unixifyPath = function(filePath){
	return filePath.replace(RegExp("\\" + path.sep, "g"), "/");
}

const exportJsFile = async function(fromFile, basePath, baseURL, outputDir, newPrefix){
	const isJSON = fromFile.endsWith(".json");
	let filename = baseURL + newPrefix + unixifyPath(fromFile.substring(basePath.length + 1));
	let outputFilePath = outputDir + newPrefix.replace(/\//g, path.sep) + fromFile.substring(basePath.length + 1);
	if(isJSON){
		filename = filename.substring(0, filename.length - 4) + "js";
		outputFilePath = outputFilePath.substring(0, outputFilePath.length - 4) + "js";
	}
	await fsp.mkdir(outputFilePath.substring(0, outputFilePath.lastIndexOf(path.sep)), {recursive: true});

	const rs = fs.createReadStream(fromFile);
	const ws = fs.createWriteStream(outputFilePath);

	await writeAndWait(ws, "globalThis.requirifierModuleDefinitions[\"" +
		stringEscapeSquences(filename) +
		"\"] = function(require, module, __dirname, __filename){let exports = module.exports" +
		(isJSON ? "=" : ";")
	);
	// console.log(inputFile.path, "->", outputFile.path);
	rs.pipe(ws, {end: false});
	await new Promise((resolve) => {
		rs.once("close", resolve);
	});
	ws.end("}\n");
	const result = {
		url: filename,
		requireNames: [
			filename,
			filename.substring(0, filename.length - 3)
		],
		filename,
		dirname: filename.substring(0, filename.lastIndexOf("/"))
	}
	if(isJSON){
		result.requireNames.push(filename + "on");
	}
	if(filename.endsWith("/index.js")){
		result.requireNames.push(result.dirname);
	}
	return result;
}

const exportJsFiles = async function(fileList, basePath, baseURL, outputDir, newPrefix){
	const result = [];
	for(let i = 0; i < fileList.length; i += 1){
		result[i] = await exportJsFile(fileList[i], basePath, baseURL, outputDir, newPrefix)
	}
	return result;
}
const exportVerbatimFiles = async function(fileList, basePath, outputDir, newPrefix){
	for(let i = 0; i < fileList.length; i += 1){
		const outputFilePath = outputDir + newPrefix.replace(/\//g, path.sep) + fileList[i].substring(basePath.length)
		await fsp.mkdir(outputFilePath.substring(0, outputFilePath.lastIndexOf(path.sep)), {recursive: true});
		await fsp.copyFile(fileList[i],  outputFilePath);
	}
}

const exportModuleList = async function(outputDir, baseURL, basePath, moduleListName, moduleList, allPolyfills){
	const ws = fs.createWriteStream(outputDir + path.sep + "requirifier-module-list-" + moduleListName + ".js");
	const polyfillList = {};
	moduleList.polyfillsRequired.forEach(v => {
		if(polyfillTests[v] == null){
			throw new Error("No polyfill test defined for " + v);
		}
		polyfillList[v] = polyfillTests[v];
		allPolyfills.add(v);
	});

	if(moduleListName === "main"){
		await writeAndWait(ws, "globalThis.requirifierModuleList = [\n");
	}else{
		await writeAndWait(ws, "globalThis.addRequirifierModules([\n");
	}
	const moduleDefinitionList = await exportJsFiles(moduleList.include, basePath, baseURL, outputDir, "");
	for(let i = 0; i < moduleDefinitionList.length; i += 1){
		await addModuleDefinition(ws, moduleDefinitionList[i]);
	}
	await exportVerbatimFiles(moduleList.verbatim, basePath, outputDir, "");
	for(const dependencyName in moduleList.dependencies){
		const dependency = moduleList.dependencies[dependencyName];
		const modulePrefix = "node_modules/" + dependencyName + "/";

		const moduleDefinitionList = await exportJsFiles(dependency.include, dependency.modulePath, baseURL, outputDir, modulePrefix);
		moduleDefinitionList.unshift(await exportJsFile(dependency.main, dependency.modulePath, baseURL, outputDir, modulePrefix));
		
		const modulefilename = baseURL + modulePrefix.substring(0, modulePrefix.length - 1);
		if(moduleDefinitionList[0].requireNames.indexOf(modulefilename) === -1){
			moduleDefinitionList[0].requireNames.push(modulefilename);
		}
		
		for(let i = 0; i < moduleDefinitionList.length; i += 1){
			await addModuleDefinition(ws, moduleDefinitionList[i]);
		}
		await exportVerbatimFiles(dependency.verbatim, dependency.modulePath, outputDir, modulePrefix);
	}

	if(moduleListName === "main"){
		ws.end(
			"]\n" +
			"globalThis.requirifierMainModule = \"" + baseURL + stringEscapeSquences(moduleList.mainModule) + "\";\n" +
			"globalThis.requirifierBaseURL = \"" + baseURL + "\";\n" +
			"globalThis.requirifierPolyfills = " + JSON.stringify(polyfillList, null, "\t") + "\n"
		);
	}else{
		ws.end(
			"],\n" +
			"\"" + baseURL + stringEscapeSquences(moduleList.mainModule) + "\",\n" +
			JSON.stringify(polyfillList, null, "\t") + ");\n"
		);
	}
}

const main = async function(){
	try{
		const bigFileList = await generateFileList();
		console.log("Generated big file list:", util.inspect(bigFileList, true, 10, true));
		// TODO: We should probably only update files that have been changed, but that would require keeping track of files we no longer use, and I'm lazy
		await removeDirectoryContents(bigFileList.outputDir);
		const allPolyfills = new Set();
		for(const moduleListName in bigFileList.moduleList){
			console.log("Exporting module list " + moduleListName + "...");
			await exportModuleList(
				bigFileList.outputDir,bigFileList.baseURL,
				bigFileList.basePath,
				moduleListName,
				bigFileList.moduleList[moduleListName],
				allPolyfills
			);
		}
		if(allPolyfills.size > 0){
			await fsp.mkdir(bigFileList.outputDir + path.sep + "requirifier-polyfills");
		}
		const copyPromises = allPolyfills.size === 0 ? [] : [...allPolyfills].map(async polyfillName => {
			return fsp.copyFile(
				__dirname + "/../files-to-copy/polyfills/" + polyfillName + ".js",
				bigFileList.outputDir + path.sep + "requirifier-polyfills" + path.sep + polyfillName + ".js"
			)
		});
		copyPromises.push(fsp.copyFile(__dirname + "/../files-to-copy/requirifier-init.js", bigFileList.outputDir + path.sep + "requirifier-init.js"));
		copyPromises.push(fsp.copyFile(__dirname + "/../files-to-copy/global-this-shim.js", bigFileList.outputDir + path.sep + "global-this-shim.js"));
		await Promise.all(copyPromises);
		console.log("done!");
	}catch(ex){
		console.error(ex.stack);
	}
}
main();
