#!/usr/bin/env node

(function() {
	const fs = require('fs');
	const path = require('path');

	var writeFile = function(file, text) {
		try {
			console.log("Outputting '" + file + "'..")
			fs.writeFileSync(file, text);
		}
		catch (e) {
			throw new Error(e);
		}
	};


	var writeMarkdown = function(source, output) {
		return function() {
			var markdown = "";

			for (let entry of source) {
				markdown += "# " + entry.title + "\n\n" + entry.text + "\n\n\n";
			}

			writeFile(output + ".md", markdown);
			return markdown;
		}();
	};


	var convertTiddlyToMarkdown = function(source, output) {
		var convertMarkdown = function(text) {
			// convert emphasis markdown
			text = text.replace(/\/\/((?:[^/]|\/(?!\/))*)\/\//g, "*$1*");

			// convert strong markdown
			text = text.replace(/''((?:[^']|'(?!'))*)''/g, "**$1**");

			// convert strike markdown
			text = text.replace(/~~((?:[^']|~(?!~))*)~~/g, "<s>$1</s>");

			// convert underline markdown
			text = text.replace(/__((?:[^']|_(?!_))*)__/g, "<u>$1</u>");

			// convert header markdown
			text = text.replace(/(?<=(?:^|\n)[\t ]*)(!+)[\t ]+(.+)/g, function(m, p1, p2) {
				if (p1.length === 1) return "<h1>" + p2.trim() + "</h1>\n";
				return "#".repeat(p1.length) + " " + p2.trim();
			});

			// convert links
			text = text.replace(/\[\[((?:(?!\||\]\])[^])+)(?:\|((?:(?!\]\])[^])+))?\]\]/g, function(m, p1, p2) {
				p1 = p1.replace(/[_ ]/g, '-').toLowerCase().trim();
				return "[" + p1 + "](#" + (p2 ? p2.trim() : p1) + ")";
			});

			return text;
		};

		console.log("Converting tiddlywiki to markdown..");

		source = JSON.parse(source);

		var tiddly = [];
		for (let entry of source) {
			if (entry.title.substring(0, 2) === "$:" || ("tags" in entry && entry.tags.indexOf("$:") !== -1)) continue;
			entry.text = convertMarkdown(entry.text);
			tiddly.push(entry);
		}

		return writeMarkdown(tiddly, output);
	};


	var convertTwineToMarkdown = function(source, output) {
		var convertLinks = function(text) {
			return text.replace(/\[\[((?:(?!\||<-|->|\]\])[^])+)(?:(\||<-|->)((?:(?!\]\])[^])+))?\]\]/g, function(m, p1, p2, p3) {
				p1 = p1.replace(/[_ ]/g, '-').toLowerCase().trim();
				if (p2 === "<-") return "[" + p3.trim() + "](#" + p1 + ")";
				return "[" + p1 + "](#" + (p3 ? p3.trim() : p1) + ")";
			});
		};

		var unencode = function(text) {
			text = text.replace(/\\"/g, '"');
			text = text.replace(/\\'/g, "'");
			text = text.replace(/&quot;/gi, '"');
			text = text.replace(/&amp;/gi, '&');
			text = text.replace(/&lt;/gi, "<");
			text = text.replace(/&gt;/gi, ">");
			return text;
		};

		return function() {
			console.log("Converting twine archive to markdown..");

			var entries = [];
			var passages = source.match(/<tw-passagedata[^<]+<\/tw-passagedata>/g);
			if (passages === null) throw new Error("Not a valid twine export HTML file.");

			for (let passage of passages) {
				let data = passage.match(/[^n]+name="((?:\\"|[^"])+)"[^>]*>((?:<(?!\/tw-passagedata)|[^<])+)<\/tw-passagedata>/);
				if (data === null) continue;

				let title = unencode(data[1].trim());

				let text = data[2].trim();
				text = unencode(text);
				text = convertLinks(text);
				entries.push({"title": title, "text": text});
			}

			return writeMarkdown(entries, output);
		}();
	};


	var convertTweeToMarkdown = function(source, output) {
		var convertLinks = function(text) {
			return text.replace(/\[\[((?:(?!\||<-|->|\]\])[^])+)(?:(\||<-|->)((?:(?!\]\])[^])+))?\]\]/g, function(m, p1, p2, p3) {
				p1 = p1.replace(/[_ ]/g, '-').toLowerCase().trim();
				if (p2 === "<-") return "[" + p3.trim() + "](#" + p1 + ")";
				return "[" + p1 + "](#" + (p3 ? p3.trim() : p1) + ")";
			});
		};

		return function() {
			console.log("Converting twee to markdown..");

			source = source.split(/(?:^|\n)::[\t ]+/g);

			var entries = [];

			for (let entry of source) {
				if (!entry.trim().length) continue;

				let index = entry.indexOf("\n");
				let title = entry.substring(0, index).trim();

				let text = entry.substring(index).trim();
				text = convertLinks(text);
				entries.push({"title": title, "text": text });
			}

			return writeMarkdown(entries, output);
		}();
	};


	var convertSadakoToMarkdown = function(source, output) {
		var convertLinks = function(text) {
			return text.replace(/\[:((?:(?!@:|:\])[^])+)(?:@:((?:(?!:\])[^])+))?:\]/g, function(m, p1, p2) {
				p1 = p1.replace(/[_ ]/g, '-').toLowerCase().trim();
				return "[" + p1 + "](#" + (p2 ? p2.trim() : p1) + ")";
			});
		};

		return function() {
			console.log("Converting sadako to markdown..");

			source = source.split(/(?:^|\n)##[\t ]+/);

			var entries = [];

			for (let entry of source) {
				if (!entry.trim().length) continue;

				let index = entry.indexOf("\n");
				let title = entry.substring(0, index).trim();

				let text = entry.substring(index).trim();
				text = convertLinks(text);
				entries.push({"title": title, "text": text });
			}

			return writeMarkdown(entries, output);
		}();
	};


	var convertMarkdownToJSON = function(source) {
		source = source.split(/(?:^|\s)#[\t ]+/);

		var entries = [];

		for (let entry of source) {
			if (!entry.trim().length) continue;

			let index = entry.indexOf("\n");
			let title = entry.substring(0, index).trim();
			let text = entry.substring(index).trim();
			let mdref = title.replace(/[_ ]/g, '-').toLowerCase();

			entries.push({"title": title, "mdref": mdref, "text": text });
		}

		return entries;
	};


	var convertJsonToGraphviz = function(source, output) {
		var trimLines = function(text) {
			text = text.replace(/<br(?: ?\/)?>/gi, "\n");
			text = text.replace(/[\t ]*\r?\n[\t ]*/g, "\n");
			text = text.replace(/\r?\n[\t ]*\r?\n[\t ]*\r?\n/g, "\n");
			return text.trim();
		};

		var quote = function(text) {
			if (/\s|[-><]/.test(text)) return '"' + text.replace(/"/g, '\\"') + '"';
			return text;
		}

		var getEntries = function(source) {
			var getEntry = function(entry, entries, missing) {
				var title = entry.title;
				var id = entry.mdref;

				if (id in entries) throw new Error("Duplicate ID found: " + id);

				delete missing[id];
				entries[id] = {"title": title};

				return entries[id];
			};

			var getLabel = function(source) {
				var label = source.text.match(/<!--\s*(?!\s*(?:!|flags|epub:))((?:-(?!->)|[^-])+)\s*-->/);
				if (label !== null) {
					label = trimLines(label[1]);
					label = label.split("\n");
				}

				return label;
			};

			var getLinks = function(source) {
				var links = [];

				source.text.replace(/(?<!!)\[([^\]]+)\]\(#?([^)]+)\)/g, function(match, p1, p2) {
					var link = p2.trim().toLowerCase();
					links.push(link);
				});

				return (links.length) ? links : null;
			};

			var getColor = function(source) {
				var type = source.text.match(/<!--\s*(start|bad end|good end)\s*-->/i);
				if (type === null) return null;
				else {
					if (type[1] === "start") return "blue";
					if (type[1] === "bad end") return "red";
					if (type[1] === "good end") return "goldenrod";
				}
			}

			var getFlags = function(source) {
				var flags = source.text.match(/<!--\s*flags\s+((?:-(?!->)|[^-])+)\s*-->/i);
				if (flags !== null) {
					flags = trimLines(flags[1]);
					flags = flags.replace(/\n/g, "<br/>");
				}

				return flags;
			}

			return function() {
				var entries = {};
				var missing = {};

				for (let item of source) {
					if (/<!--\s*nograph\s*-->/i.test(item.text)) continue;
					let entry = getEntry(item, entries, missing);
					entry.mdref = item.mdref;
					entry.label = getLabel(item);
					entry.links = getLinks(item, entries, missing);
					entry.color = getColor(item);
					entry.flags = getFlags(item);
				}

				return [entries, missing];
			}();
		}

		var getGraph = function(entries, missing) {
			var graphEntries = function(entries) {
				var getLabel = function(entry) {
					var options = "";
					var add_style = 'face="monospace" point-size="11" color="steelblue"';
					var remove_style = 'face="monospace" point-size="11" color="tomato"';

					if (entry.flags !== null) {
						var flags = entry.flags.split(/\n|<br\s*\/?>/gi);
						var add = [];
						var remove = [];

						for (let item of flags) {
							if (/\s*-\s*(.+)/.test(item)) {
								item = item.match(/-\s*(.+)/)[1];
								remove.push("- " + item.trim());
								continue;
							}

							add.push("+ " + item.match(/\s*\+?\s*(.+)/)[1].trim());
						}

						options = 'label=<' + entry.title;
						if (entry.label !== null) options += ": " + entry.label.join("<br/>");
						if (add.length) options += '<br/><font ' + add_style + ">" +  add.join("<br/>") + '</font>';
						if (remove.length) options += '<br/><font ' + remove_style + ">" + remove.join("<br/>") + '</font>';
						options += '>';
					}
					else if (entry.label !== null) options = 'label="' + entry.title.replace(/"/g, '\\"') + ": " + entry.label. join("\n") + '"';
					else if (entry.title !== entry.mdref) options = 'label="' + entry.title.replace(/"/g, '\\"') + '"';
					return options;
				};

				var graph = "";

				for (let [id, entry] of Object.entries(entries)) {

					let options = getLabel(entry);
					if (options)  {
						graph += "\t" + quote(id) + " [";
						

						if (entry.color !== null) options += (options.length ? ", " : "") + 'color="' + entry.color + '"';
						graph += options + "]\n";
					}
					else graph += "\t" + quote(id) + ";\n";
				}

				return graph;
			};

			var graphMissing = function(entries, missing) {
				var graph = "";
				for (let id in entries) {
					let entry = entries[id];

					if (entry.links === null) continue;
					let links = [];
					for (let link of entry.links) {
						if (!(link in entries)) missing[quote(link)] = true;
						links.push(quote(link));
					}
					graph += "\t" + quote(entry.mdref) + " -> " + links.join(", ") + ";\n";
				}

				if (!Object.keys(missing).length) return graph;

				return graph.trimEnd() + "\n\t" + Object.keys(missing).join(", ") + ' [style=filled, fillcolor="darkgray"]';
			};

			return function() {
				var graph = "digraph {\n\tnode [shape=box];\n";

				graph += graphEntries(entries);
				graph += graphMissing(entries, missing);

				graph = graph.replace(/\n\n\n/g, "\n\n");

				graph = graph.trim() + "\n}";
				return graph;
			}();
		}

		void function() {
			var [entries, missing] = getEntries(source);

			var graph = getGraph(entries, missing);

			writeFile(output + ".dot", graph.trim());
		}();
	};


	var convertJsonToEpub = function(source, output) {
		var convertToXHTML = function(text) {
			// remove comments
			text = text.replace(/[\t ]*<!--(?:-(?!->)|[^-])+\s*-->.*/g, "");

			// add ending slash to single tags
			text = text.replace(/<((?:img|br|hr)(?:[^/>]|\/(?!>))*)\s*>/gi, "<$1/>");

			// remove leading blank lines
			text = text.replace(/^((?:[\t ]*\r?\n)+)/, "");

			// replace markdown links with anchors
			text = text.replace(/\[([^\]]+)\]\(#?([^)]+)\)/g, function(match, p1, p2) {
				let link = (p2 || p1).trim()
				return '<a href="' + link + '">' + p1.trim() + '</a>';
			});

			// replace strong markdown with bold tag
			text = text.replace(/\*{2}(?!\s)((?:[^\r\n\t* ]|[\t ](?!\*{2})|\*(?!\*))+)\*{2}/g, "<b>$1</b>");

			// replace emphasis markdown with italics tag
			text = text.replace(/\*(?!\s)((?:[^\r\n\t* ]|[\t ](?!\*))+)\*/g, "<i>$1</i>");
			text = text.replace(/(?<=\s|^)_((?:[^_\r\n]|_(?!\s))+)_/g, "<i>$1</i>");

			// limit blanks lines to only two in a row
			text = text.replace(/\r?\n[\t ]*\r?\n[\t ]*\r?\n/g, "\n\n");

			// replace center tag with a text-aligned div
			text = text.replace(/<center\s*>((?:<(?!\/center\s*>)|[^<])+)<\/center\s*>/gi, '<div style="width:100%; text-align:center">$1</div>');

			// replace header markdown with header tag
			text = text.replace(/(?:^|\n)[\t ]*(#+)[\t ](.*)/g, function(match, p1, p2) {
				return '<h' + p1.length + '>' + p2 + '</h' + p1.length + '>';
			});

			// if div exists inside header, add its style to the header tag instead
			text = text.replace(/<(h[0-9]|li)\s*>\s*<div\s*([^>]*)\s*>\s*((?:[^<]|<(?!\/div\s*>\s*)|<\/div\s*>\s*(?!<\/\1>))+)\s*<\/div\s*>\s*<\/\1\s*>/i, '<$1 $2>$3</$1>');

			return text;
		};

		var collectSections = function(source, output) {
			var condenseLines = function(text) {
				var lines = [];

				for (let line of text.split(/\r?\n[\t ]*\r?\n/g)) {
					line = line.trim();

					if (!line.length) continue;
					if (/^\s*<\/?(h[0-9]|p|div|ul|ol|li)( [^>]+|)>/i.test(line)) {
						lines.push(line);
					}
					else lines.push('<div class="paragraph">' + line + '</div>');
				}

				text = lines.join("\n");
				text = text.replace(/(\r?\n\s*)(?!\s|<)/g, '<br/>');

				return text;
			};

			var convertLink = function(id, text) {
				text = "s" + (id.toString().padStart(4, "0")) + ".xhtml";
				return text;
			};

			var getSection = function(entry, data) {
				var html =
					'<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">\n' +
					'<head>\n' +
					'	<title>' + data.meta.title + '</title>\n' +
					'	<meta http-equiv="Content-Type" content="text/html;charset=UTF-8" />\n' +
					'	<link type="text/css" href="style.css" rel="stylesheet" />\n' +
					'</head>\n' +
					'<body>\n';

				var link = data.sections[entry.mdref].link;

				var scripted = (/<script\s+/i.test(entry.text)) ? ' properties="scripted"' : "";

				data.opf += '\t\t<item id="' + link + '" href="' + link + '" media-type="application/xhtml+xml"' + scripted + ' />\n';
				data.spine += '\t\t<itemref idref="' + link + '"/>\n';

				data.files.push([path.join(output, "OEBPS", link), html + condenseLines(convertToXHTML(entry.text)).trimStart() + "\n</body>\n</html>"]);
				//data.files.push([path.join(output, "OEBPS", link), convertToXHTML(html + entry.text + "\n</body>\n</html>")]);
			};

			var getMeta = function(entry, data) {
				var match = entry.text.match(/<!--\s*epub:meta\s+((?:-(?!->)|[^-])+)-->/i);
				if (match === null) return;

				if (Object.keys(data.meta).length) console.error("Only one 'epub:meta' setting should be defined.");

				data.meta = JSON.parse(match[1]);
			};

			var getType = function(entry, data) {
				var match = entry.text.match(/<!--\s*epub:type\s+((?:-(?!->)|[^-])+)-->/i);
				if (match === null) return;

				var type = match[1].trim().toLowerCase();

				if (type in data.types) console.error("Only one '" + type + "' epub:type should be defined.");
				data.types[type] = entry.mdref;
			};

			var getNav = function(entry, data) {
				var match = entry.text.match(/<!--\s*epub:nav(?:[\t ]*\n)?((?:-(?!->)|[^-])+)\s*-->/i);
				if (match === null) return;

				if (data.nav.length) console.error("Only one 'epub:nav' should be defined.");
				data.nav = match[1].trimEnd();
			};

			var getCSS = function(entry, data) {
				var match = entry.text.match(/<!--\s*epub:css(?:[\t ]*\r?\n)*((?:-(?!->)|[^-])+)\s*-->/i);
				if (match === null) return;

				if (data.css.length) data.css += "\n\n";
				data.css += match[1].trimEnd();
			};

			var getCover = function(entry, data) {
				var match = entry.text.match(/<!--\s*epub:cover(?:[\t ]*\n)?((?:-(?!->)|[^-])+)\s*-->/i);
				if (match === null) return;
				if (data.cover.length) console.error("Only one 'epub:cover' should be defined.");

				data.cover = match[1].trim();
			};

			var getInclude = function(entry, data) {
				var match = entry.text.match(/<!--\s*epub:include(?:[\t ]*\n|[\t ]+)((?:-(?!->)|[^-])+)\s*-->/i);
				if (match === null) return;

				data.includes = data.includes.concat(JSON.parse(match[1]));
			};

			var assignShuffle = function() {
				var random = function(min, max) {
					min = Math.ceil(min);
					max = Math.floor(max);
					return Math.floor(Math.random() * (max - min + 1)) + min;
				};

				var addTitle = function(entry) {
					entry.renamed = (start !== null);

					if (show_titles || label) {
						var title;
						var label = entry.text.match(/<!--\s*epub:label\s+(.+)\s*-->/i);
						if (label !== null) label = label[1].trim();

						title = (start === null ? (label || entry.title) : entry.id);
						entry.text = '<div class="section-title">' + title + '</div>\n' + entry.text;
					}

					entry.text = '<div id="'+ entry.id + '" class="section">\n\n' + entry.text.trim() + '\n\n</div>';
				};

				var entries = [];
				var shuffled_entries = [];
				var shuffled = false;
				var start = null;
				var show_titles = false;
				var collected = false;

				for (let id = 0; id < source.length; ++id) {
					let entry = source[id];

					let match = entry.text.match(/<!--\s*epub:titles\s+(?:on|begin|start|true)(?:\s+([0-9]+))?\s*-->/i);
					if (match !== null) {
						show_titles = true;
						if (match[1] !== undefined) start = parseInt(match[1]) - entries.length;
						else start = null;
					}

					if (/<!--\s*epub:collection\s+(?:on|begin|start|true)\s*-->/i.test(entry.text)) collected = true;
					entry.collected = collected;

					entry.fixed = null;
					let fixed_id = entry.text.match(/<!--\s*epub:fixed\s+(\w(?:[\t\s]*(?:\w+|[+-]))*)\s*-->/i);
					if (fixed_id !== null) {
						let temp;
						if (/^[0-9]+$/.test(fixed_id[1])) entry.fixed = [parseInt(fixed_id[1])];
						else if ((temp = fixed_id[1].split("+")).length > 1) entry.fixed = [temp[0].trim(), parseInt(temp[1])];
						else if ((temp = fixed_id[1].split("-")).length > 1) entry.fixed = [temp[0].trim(), 0 - parseInt(temp[1])];
						else console.log("Incorrect formatting of fixed value for '" + entry.title + "'.");
					}

					if (/<!--\s*epub:shuffle\s+(?:on|begin|start|true)(?:\s+([0-9]+))?\s*-->/i.test(entry.text)) shuffled = true;
					if (shuffled) shuffled_entries.push(entry);

					if (shuffled_entries.length && (/<!--\s*epub:shuffle\s+(?:off|end|stop|false)\s*-->/i.test(entry.text) || id === source.length - 1)) {
						shuffled = false;
						let temp = [];
						let fixed = [];
						let variable = [];
						let sections = {};

						// shuffle
						for (let item of shuffled_entries) {
							sections[item.mdref] = item;

							if (start !== null && item.fixed !== null) {
								if (item.fixed.length === 1) fixed.push(item);
								else variable.push(item);
								continue;
							}

							if (!temp.length) temp = [item];
							else temp.splice(random(0, temp.length - 1) + random(0, 1), 0, item);
						}

						// add variable fixed according to anchors
						let count = 10;
						while (variable.length && count) {
							count -= 1;
							for (let a = 0; a < variable.length; ++a) {
								let item = variable[a];
								let anchor = sections[item.fixed[0]];
								if (anchor === undefined) {
									console.log("Fixed anchor '" + item.fixed[0] + "' assigned to '" + item.title + "' is not found within this shuffled block.");
									item.fixed = null;
								}
								else if (anchor.fixed === null) {
									console.log("Fixed anchor '" + anchor.title + "' assigned to '" + item.title + "' is not a fixed section.");
									item.fixed = null;
								}
								else if (anchor.mdref === item.mdref) {
									console.log("Fixed anchor for '" + item.title + "' is self-referencing.");
								}
								else if (anchor.fixed.length > 1) continue;
								else {
									item.fixed = [anchor.fixed[0] + item.fixed[1]];
									fixed.push(item);
								}
								variable.splice(a, 1);
								a -= 1;
							}
						}
						if (!count) {
							console.log("Exceeded loop count in fixed value assignments. Potential circular logic problem.");
							let error = "Unassigned fixed values:";
							for (let item of variable) {
								error += "\n    " + item.title;
							}
							console.log(error);
						}

						if (fixed.length) {
							let sorted = [];

							// sort the fixed sections
							for (let item of fixed) {
								let a;
								for (a = 0; a < sorted.length; ++a) {
									if (item.fixed[0] > sorted[a].fixed[0]) continue;
									if (item.fixed[0] === sorted[a].fixed[0]) {
										console.log("Fixed value for '" + item.title + "' conflicts with '" + sorted[a]. title + "'.");
									}
									break;
								}
								sorted.splice(a, 0, item);
							}

							// insert fixed sections
							for (let item of sorted) {
								let offset = start + entries.length;
								let index = item.fixed - offset;

								if (index < 0 || index > temp.length) {
									console.log(
										"Fixed entry value for '" + item.title + "' should be between " +
										offset + " and " + (offset + (shuffled_entries.length - 1)) + ". " +
										"Value is " + (index + offset) + "."
									);
									index = (index < 0) ? 0 : temp.length;
									continue;
								}

								temp.splice(index, 0, item);
							}
						}

						// reassign
						for (let a = 0; a < temp.length; ++a) {
							temp[a].id = ((start || 0) + a + entries.length).toString();
							addTitle(temp[a]);
						}

						entries = entries.concat(temp);
						shuffled_entries = [];
					}
					else if (!shuffled) {
						let assigned =  ((start || 0) + entries.length).toString();
						entry.id = assigned;
						addTitle(entry);
						entries.push(entry);
					}

					if (/<!--\s*epub:collection\s+(off|end|stop|false)\s*-->/i.test(entry.text)) collected = false;

					if (/<!--\s*epub:titles\s+(off|end|stop|false)\s*-->/i.test(entry.text)) {
						show_titles = false;
						start = null;
					}
				}

				return entries;
			};

			var assignIndexes = function(data) {
				var collect = false;
				var pages = [];

				for (let [id, item] of Object.entries(source)) {
					data.sections[item.mdref] = {
						"id": item.id,
						"mdref": item.mdref,
						"title": item.title,
						"renamed": item.renamed,
						"link": convertLink(id),
						"missing": false
					}

					if (item.collected) {
						if (!collect) {
							collect = convertLink(id);
							pages.push({ "title": item.title, "mdref": item.mdref, "id": collect, "text": "", "link": collect});
							data.sections[item.mdref].link = collect;
						}
						pages[pages.length - 1].text += item.text + "\n\n";
						data.page_ids[item.mdref] = pages[pages.length - 1].link + "#" + item.id
					}
					else {
						collect = false;
						pages.push(item);
					}

					if (!item.collected) collect = false;
				}

				return pages;
			};

			var redirectLinks = function(data) {
				for (let item of source) {
					item.text = item.text = item.text.replace(/(?<!!)\[([^\]]+)\]\(#?([^)]+)\)/g, function(m, p1, p2) {
						let link = p2.trim().toLowerCase();

						if (!(link in data.sections)) {
							let target = convertLink(Object.keys(data.sections).length);
							data.sections[link] = {"title": link, "mdref": link, "link": target, "renamed": false, "missing": true};
							data.missing[link] = {"title": link, "mdref": link, "text": '<em>Section "' + link + '" is missing.</em>'};
						}

						let section = data.sections[link];
						let target = (link in data.page_ids) ? data.page_ids[link] : section.link;

						if (data.sections[link].missing) {
							return '<span class="missing">[' + p1 + ' (' + link  + ')](' + target + ')</span>';
						}

						if (p1.charAt(0) === "!") link = p1.substring(1);
						else link = (section.renamed) ? section.id : section.title;

						return "[" + link  + "](" + target + ")";
					});
				}
			};

			var writeSections = function(data) {
				source = assignShuffle();
				source = assignIndexes(data);
				redirectLinks(data);

				for (let entry of source) {
					getMeta(entry, data);
					getType(entry, data);
					getNav(entry, data);
					getCSS(entry, data);
					getCover(entry, data);
					getInclude(entry, data);
				}

				for (let entry of source) {
					getSection(entry, data);
				}

				for (let entry of Object.entries(data.missing)) {
					getSection(entry[1], data);
				}
			};

			return function() {
				var data = {
					"opf": "",
					"spine": "",
					"files": [],
					"sections": {},
					"page_ids": {},
					"assigned": {},
					"missing": {},
					"meta": {},
					"types": {},
					"nav": "",
					"css": "",
					"cover": "",
					"includes": []
				};

				writeSections(data);

				return data;
			}();
		};

		var getTypes = function(data) {
			var text = "";

			for (let [key, value] of Object.entries(data.types)) {
				text += '\t\t<li><a epub:type="' + key + '" href="' + data.sections[value].link + '">' + key + '</a></li>\n';
			}
			return text;
		};

		var getMeta = function(data) {
			var getDate = function() {
				var pad = function(text) {
					return text.toString().padStart(2, "0");
				};

				var date = new Date();
				var text =
					[date.getFullYear(), pad(date.getMonth()), pad(date.getDay())].join("-") + "T" +
					[pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(":") + "Z";

				return text;
			};

			var getWriters = function(type) {
				var text = "";

				if (typeof data.meta[type] === 'string' || data.meta[type] instanceof String) {
					text = '\t\t<dc:' + type + ' id="' + type + '">' + data.meta[type] + '</dc:' + type + '>\n';
				}
				else {
					for (let a = 0; a < data.meta[type].length; ++a) {
						text += '\t\t<dc:' + type + ' id="' + type + '_' + a + '">' + data.meta[type][a] + '</dc:' + type + '>\n';
					}
				}

				return text;
			}

			var checkValues = function() {
				var values = ["identifier", "title"];

				for (let value of values) {
					if (!(value in data.meta)) console.error("Meta '" + value + "' value is required.");
				}
			}

			return function() {
				checkValues();

				var meta =
					'\t\t<dc:identifier id="pub-id">' + data.meta.identifier + '</dc:identifier>\n' +
					'\t\t<dc:title>' + data.meta.title + '</dc:title>\n' +
					'\t\t<dc:language>' + (("language" in data.meta) ? data.meta.language : "en") + '</dc:language>\n';

				if ("contributor" in data.meta) meta += getWriters("contributor");
				if ("creator" in data.meta) meta += getWriters("creator");

				if ("date" in data.meta) meta += '\t\t<dc:date>' + data.meta.date + '</dc:date>\n';
				if ("subject" in data.meta) meta += '\t\t<dc:subject>' + data.meta.subject + '</dc:subject>\n';

				meta += '\t\t<meta property="dcterms:modified">' + getDate() + '</meta>\n';

				return meta;
			}();
		};

		var writeEpubFiles = function(data) {
			var getMetaType = function(file) {
				file = file.replace(/\\?\\/g, "/");

				if (file === data.cover || copied.indexOf(file) !== -1) return false;

				copied.push(file);

				var ext = path.extname(file).toLowerCase();
				var type;

				if (ext === ".jpg") type = "image/jpeg";
				else if (ext === ".png") type = "image/png";
				else if (ext === ".gif") type = "image/gif";
				else if (ext === ".svg") type = "image/svg+xml";
				else if (ext === ".mp3") type = "audio/mpeg";
				else if (ext === ".mp4") type = "audio/mp4";
				else if (ext === ".css") type = "text/css";
				else if (ext === ".ttf") type = "font/ttf";
				else if (ext === ".otf") type = "font/otf";
				else if (ext === ".woff") type = "font/woff";
				else if (ext === ".woff2") type = "font/woff2";
				else if (ext === ".xhtml" || ext === ".html" || ext === ".htm") type = "application/xhtml+xml";
				else if (ext === ".js") type = "text/javascript";
				else {
					console.log("Extension '" + ext + '" not allowed.');
					return;
				}

				data.opf += '\t\t<item id="' + path.basename(file) + '" href="' + file + '" media-type="' + type + '"/>\n';

				return true;
			}

			var copyFile = function(item, dest) {
				var files = [];

				if (fs.lstatSync(item).isDirectory()) {
					if (!fs.existsSync(dest)) fs.mkdirSync(dest, {"recursive": true});
					files = fs.readdirSync(item);

					for (let file of files) {
						let curSource = path.join(item, file);
						if (fs.lstatSync(curSource).isDirectory()) copyFile(curSource, path.join(dest, file));
						else {
							console.log("Copying '" + curSource + '..');
							if (!getMetaType(curSource)) continue;
							fs.copyFileSync(curSource, path.join(dest, path.basename(file)));
						}
					}
				}
				else {
					if (!fs.existsSync(path.dirname(dest))) fs.mkdirSync(path.dirname(dest), {"recursive": true});
					console.log("Copying '" + item + '..');
					if (!getMetaType(item)) return;
					fs.copyFileSync(item, dest);
				}
			};

			var copied = [];

			if (fs.existsSync(output)) fs.rmdirSync(output, {"recursive": true});

			fs.mkdirSync(output);
			fs.mkdirSync(path.join(output, "META-INF"));
			fs.mkdirSync(path.join(output, "OEBPS"));

			if (data.cover.length) {
				var cover_dest = path.join(output, "OEBPS", data.cover);
				if (!fs.existsSync(path.dirname(cover_dest))) fs.mkdirSync(path.dirname(cover_dest), {"recursive": true});
				fs.copyFileSync(data.cover, cover_dest);
				data.cover = data.cover.replace(/\\?\\/g, "/");
			}

			for (let file of data.files) {
				writeFile(file[0], file[1]);
			}

			for (let include of data.includes) {
				copyFile(include, path.join(output, "OEBPS", include));
			}
		};

		void function() {
			var data = collectSections(source, output);

			// write sections and included files
			writeEpubFiles(data);

			// write mimetype
			writeFile(path.join(output, "mimetype"), "application/epub+zip");

			// write xml
			writeFile(path.join(output, "META-INF", "container.xml"),
				'<?xml version="1.0"?>\n' +
				'<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
				'	<rootfiles>\n' +
				'		<rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml" />\n' +
				'	</rootfiles>\n' +
				'</container>'
			);

			// write opf file
			writeFile(path.join(output, "OEBPS", "package.opf"),
				'<?xml version="1.0"?>\n' +
				'<package version="3.0"\n' +
				'         xmlns="http://www.idpf.org/2007/opf"\n' +
				'         unique-identifier="pub-id">\n\n' +
				'	<metadata xmlns:opf="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
						getMeta(data) +
				'	</metadata>\n\n' +
				'	<manifest>\n' +
				'		<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n' +
				'		<item id="style.css" href="style.css" media-type="text/css"/>\n' +
						((data.cover.length) ? '\t\t<item id="cover" href="' + data.cover + '" media-type="image/jpeg" properties="cover-image"/>\n' : '') +
						data.opf +
				'	</manifest>\n\n' +
				'	<spine>\n' +
						data.spine +
				'	</spine>\n\n' +
				'</package>'
			);

			// write nav file
			writeFile(path.join(output, "OEBPS", "nav.xhtml"),
				'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n' +
				'<head>\n' +
				'	<meta http-equiv="Content-Type" content="text/html;charset=UTF-8" />\n' +
				'	<title>' + output + '</title>\n' +
				'	<link rel="stylesheet" type="text/css" href="style.css" />\n' +
				'</head>\n' +
				'<body>\n' +
				'<nav epub:type="toc" id="toc">\n' +
				'<h1>Table of Contents</h1>\n' +
					convertToXHTML(data.nav).trimEnd() + '\n' +
				'</nav>\n' +
				'<nav epub:type="landmarks" hidden="">\n' +
				'	<ol>\n' +
						getTypes(data) +
				'	</ol>\n' +
				'</nav>\n' +
				'</body>\n' +
				'</html>'
			);

			// write css
			writeFile(path.join(output, "OEBPS", "style.css"), data.css);
		}();
	};

	void function() {
		var checkHelp = function() {
			var id = process.argv.indexOf("-h");
			if (id === -1) id = process.argv.indexOf("--help");
			if (id !== -1) {
				console.log(
					"\nExample: gamebook_markdown file1.tw file2.tw file3.tw -o story -g -e\n\n" +
					"Flags:\n" +
					'  -o or --output: project name for output (defaults to "story". do not include extensions)\n' +
					"  -g or --graphviz: outputs to a .dot file for graphviz\n" +
					"  -e or --epub: outputs to an epub project folder\n"
				);
				return true;
			}
			return false;
		}

		var checkGraphviz = function() {
			var id = process.argv.indexOf("-g");
			if (id === -1) id = process.argv.indexOf("--graphviz");
			if (id !== -1) {
				process.argv.splice(id, 1);
				return true;
			}
			return false;
		}

		var checkEpub = function() {
			var id = process.argv.indexOf("-e");
			if (id === -1) id = process.argv.indexOf("--epub");
			if (id !== -1) {
				process.argv.splice(id, 1);
				return true;
			}
			return false;
		}

		var checkOutput = function() {
			var output = false;

			var id = process.argv.indexOf("-o");
			if (id === -1) id = process.argv.indexOf("--output");
			if (id === -1) {
				throw new Error("Output must be specified with -o or --output flag.");
			}

			if (id !== -1) {
				if (id === process.argv.length - 1) throw new Error("Output flag found without value.");
				output = process.argv[id + 1];
				process.argv.splice(id, 2);
			}
			if (process.argv.indexOf("-o") !== -1 || process.argv.indexOf("--output") !== -1) {
				throw new Error("Output should only be declared once.");
			}

			return output;
		}

		void function() {
			if (checkHelp()) return;

			if (process.argv.length < 3) throw new Error("No input files specified.");

			var output = checkOutput() || "story";

			var graphviz_enabled = checkGraphviz();
			var epub_enabled = checkEpub();
			var source = [];

			try {
				for (let a = 2; a < process.argv.length; ++a) {
					let file = fs.readFileSync(process.argv[a]);
					let input = file.toString() + "\n";

					let ext = process.argv[a].substring(process.argv[a].lastIndexOf(".") + 1).toLowerCase();

					if (ext === "js" || ext === "json") input = convertTiddlyToMarkdown(input, output);
					else if (ext === "sko") input = convertSadakoToMarkdown(input, output);
					else if (ext === "tw" || ext === "twee") input = convertTweeToMarkdown(input, output);
					else if (ext === "html") input = convertTwineToMarkdown(input, output);
					else if (ext === "md" || ext === "markdown") {
						console.log("Loading markdown..");
						if (!graphviz_enabled && !epub_enabled) throw new Error("Nothing to do! Please use --epub or --graphviz flag for conversion.");
					}
					else throw new Error("Unknown extension type: " + ext);
		
					source = source.concat(convertMarkdownToJSON(input));
				}
			}
			catch (e) {
				throw new Error(e);
			}

			if (graphviz_enabled) convertJsonToGraphviz(source, output);
			if (epub_enabled) convertJsonToEpub(source, output);

			console.log("Conversion succeeded.");
		}();
	}();
}());