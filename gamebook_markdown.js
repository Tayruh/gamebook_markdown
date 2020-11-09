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
				return "[" + p1.trim() + "](#" + (p2 ? p2.trim() : p1.trim()) + ")";
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
				if (p2 === "<-") return "[" + p3.trim() + "](#" + p1.trim() + ")";
				return "[" + p1.trim() + "](#" + (p3 ? p3.trim() : p1.trim()) + ")";
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
				if (p2 === "<-") return "[" + p3.trim() + "](#" + p1.trim() + ")";
				return "[" + p1.trim() + "](#" + (p3 ? p3.trim() : p1.trim()) + ")";
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
				return "[" + p1.trim() + "](#" + (p2 ? p2.trim() : p1.trim()) + ")";
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
			text = text.replace(/\[([^\]]+)\]\(#?([^)]+)\)/g, function(m, p1, p2) {
				return "[[" + p1 + ((p1 !== p2) ? "|" + p2 : "") + "]]";
			});
			entries.push({"title": title, "text": text });
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
			if (/\s/.test(text)) return '"' + text.replace(/"/g, '\\"') + '"';
			return text;
		}

		var getEntries = function(source) {
			var getEntry = function(entry, entries, missing) {
				var title = entry.title;
				var id = quote(title);

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

			var getLinks = function(source, entries, missing) {
				var links = source.text.match(/(?<=\[\[)((?:[^\]])*)(?=\]\])/g);

				if (links !== null) {
					for (let a = 0; a < links.length; ++a) {
						let parts = links[a].split("|");
						let link = (parts[1] || parts[0]).trim();
						if (!(link in entries)) missing[quote(link)] = true;
						links[a] = quote(link);
					}
				}

				return links;
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
					return options;
				};

				var graph = "";

				for (let [id, entry] of Object.entries(entries)) {
					let added = false;
					if (entry.label || entry.color || entry.flags) {
						added = true;
						graph += "\t" + id + " [";
						let options = getLabel(entry);

						if (entry.color !== null) options += (options.length ? ", " : "") + 'color="' + entry.color + '"';
						graph += options + "]\n";
					}
					
					if (entry.links !== null) graph += "\t" + id + " -> " + entry.links.join(", ") + ";\n\n";
					else if (!added) graph += "\t" + quote(entry.title) + ";\n\n";
				}

				return graph;
			};

			var graphMissing = function(missing) {
				if (!Object.keys(missing).length) return "";

				var id;
				var graph = "";

				for (id in missing) { graph += id + ", "; }

				return "\n\t" + graph.substring(0, graph.lastIndexOf(",")).trim() + ' [style=filled, fillcolor="darkgray"]';
			};

			return function() {
				var graph = "digraph {\n\tnode [shape=box];\n\n";

				graph += graphEntries(entries);
				graph += graphMissing(missing);

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
			text = text.replace(/(?:^|\n)[\t ]*<!--(?:-(?!->)|[^-])+\s*-->.*/g, "");

			// add ending slash to single tags
			text = text.replace(/<((?:img|br)(?:[^/>]|\/(?!>))*)\s*>/gi, "<$1/>");

			// remove leading blank lines
			text = text.replace(/^((?:[\t ]*\r?\n)+)/, "");

			// replace markdown links with anchors
			text = text.replace(/\[\[s*([^\]|]+)(?:\|([^\]]*))?\]\]/g, function(match, p1, p2) {
				let link = (p2 || p1).trim()
				return '<a href="' + link + '">' + p1.trim() + '</a>';
			});

			// replace strong markdown with bold tag
			text = text.replace(/\*{2}(?!\s)((?:[^\r\n\t* ]|[\t ](?!\*{2})|\*(?!\*))+)\*{2}/g, "<b>$1</b>");

			// replace emphasis markdown with italics tag
			text = text.replace(/\*(?!\s)((?:[^\r\n\t* ]|[\t ](?!\*))+)\*/g, "<i>$1</i>");

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
				var section = "";

				for (let line of text.split(/\r?\n[\t ]*\r?\n/g)) {
					line = line.trim();
	
					if (!line.length) continue;
					if (/^\s*(<h[0-9]|<p|<div|<ul|<ol|<li)( [^>]|)>/i.test(line)) {
						section += line + "\n";
					}
					else section += '<div class="paragraph">' + line + '</div>\n';
				}

				return section.trim();
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

				var link = data.sections[entry.title].link;

				data.opf += '\t\t<item id="' + link + '" href="' + link + '" media-type="application/xhtml+xml"/>\n';
				data.spine += '\t\t<itemref idref="' + link + '"/>\n';

				data.files.push([path.join(output, "OEBPS", link), html + condenseLines(convertToXHTML(entry.text)).trimStart() + "\n</body>\n</html>"]);
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
				data.types[type] = entry.title;
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

				var addTitle = function(entry, title) {
					entry.text = '<div class="section-title" id="' + entry.id + '">' + title + '</div>\n' + entry.text;
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
					
					if (/<!--\s*epub:shuffle\s+(?:on|begin|start|true)(?:\s+([0-9]+))?\s*-->/i.test(entry.text)) shuffled = true;
					if (shuffled) shuffled_entries.push(entry);

					if (shuffled_entries.length && (/<!--\s*epub:shuffle\s+(?:off|end|stop|false)\s*-->/i.test(entry.text) || id === source.length - 1)) {
						shuffled = false;

						let temp = [];
						for (let item of shuffled_entries) {
							if (!temp.length) temp = [item];
							else temp.splice(random(0, temp.length - 1) + random(0, 1), 0, item);
						}

						for (let a = 0; a < temp.length; ++a) {
							temp[a].id = ((start || 0) + a + entries.length).toString();
							temp[a].renamed = (start !== null);
							let label = temp[a].text.match(/<!--\s*epub:label\s+(.+)\s*-->/i);
							if (label !== null) label = label[1].trim();

							if (show_titles || label) addTitle(temp[a], (start === null ? (label || temp[a].title) : (temp[a].id).toString()));
						}

						entries = entries.concat(temp);
						shuffled_entries = [];
					}
					else if (!shuffled) {
						let assigned =  ((start || 0) + entries.length).toString();
						entry.id = assigned;
						entry.renamed = (start !== null);
						let label = entry.text.match(/<!--\s*epub:label\s+(.+)\s*-->/i);
						if (label !== null) label = label[1].trim();
						if (show_titles || label) addTitle(entry, (start === null ? (label || entry.title) : assigned));
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
					data.sections[item.title] = {
						"id": item.id,
						"title": item.title,
						"renamed": item.renamed,
						"link": convertLink(id), 
						"missing": false
					}

					if (item.collected) {
						if (!collect) {
							collect = convertLink(id);
							pages.push({ "title": item.title, "id": collect, "text": "", "link": collect});
							data.sections[item.title].link = collect;
						}
						pages[pages.length - 1].text += item.text + "\n\n";
						data.page_ids[item.title] = pages[pages.length - 1].link + "#" + item.id
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
					item.text = item.text = item.text.replace(/\[\[s*([^\]|]+)(?:\|([^\]]*))?\]\]/g, function(m, p1, p2) {
						let link = (p2 || p1).trim();
						
						if (!(link in data.sections)) {
							let target = convertLink(Object.keys(data.sections).length);
							data.sections[link] = {"id": link, "link": target, "missing": true};
							data.missing[link] = {"title": link, "text": '<em>Section "' + link + '" is missing.</em>'};
						}
						
						let section = data.sections[link];
						let target = (link in data.page_ids) ? data.page_ids[link] : section.link;

						if (data.sections[link].missing) {
							return '<span class="missing">[[' + p1 + ' (' + link  + ')|' + target + ']]</span>'; 
						}
						
						if (p1.charAt(0) === "!") link = p1.substring(1);
						else link = (section.renamed) ? section.id : p1;

						return "[[" + link  + "|" + target + "]]";
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
			
			var source = "";
			var output = checkOutput() || "story";

			var graphviz_enabled = checkGraphviz();
			var epub_enabled = checkEpub();

			try {
				for (let a = 2; a < process.argv.length; ++a) {
					let file = fs.readFileSync(process.argv[a]);
					source += file.toString() + "\n";
				}
			}
			catch (e) {
				throw new Error(e);
			}
			
			var ext = process.argv[2].substring(process.argv[2].lastIndexOf(".") + 1).toLowerCase();

			if (ext === "js" || ext === "json") source = convertTiddlyToMarkdown(source, output);
			else if (ext === "sko") source = convertSadakoToMarkdown(source, output);
			else if (ext === "tw" || ext === "twee") source = convertTweeToMarkdown(source, output);
			else if (ext === "html") source = convertTwineToMarkdown(source, output);
			else if (ext === "md" || ext === "markdown") {
				console.log("Loading markdown..");
				if (!graphviz_enabled && !epub_enabled) throw new Error("Nothing to do! Please use --epub or --graphviz flag for conversion.");
			} 
			else throw new Error("Unknown extension type: " + ext);

			source = convertMarkdownToJSON(source);

			if (graphviz_enabled) convertJsonToGraphviz(source, output);
			if (epub_enabled) convertJsonToEpub(source, output);
			
			console.log("Conversion succeeded.");
		}();
	}();
}());