{
	"translatorID": "8a676c00-68e5-4f26-a360-6c9aac64d0c0",
	"label": "ARVO journal",
	"creator": "Shuichi Makita",
	"target": "^.*://[^.]+\\.arvojournals\\.org",
	"minVersion": "",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsibv",
	"lastUpdated": "2020-07-01 01:54:39"
}

/*
ARVO journals' Translator
Copyright (C) Shuichi Makita

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

function detectWeb(doc, url) {
	// Prevent inner frames from getting detected
	try {
		if(doc.defaultView !== doc.defaultView.top){
			return;
		}
	} catch(e) {
		return;
	};
	
	if (url.indexOf("search.cfm") != -1) {
		return "multiple";
	} else if (url.toLowerCase().indexOf("article.aspx") != -1) {
		return getArticleType(doc, url, null);
	}
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = '//div[@class="sri-summary"]';
		var rows = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var row;
		while (row = rows.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate('.//h3[@class="sri-title"]', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var id = doc.evaluate('.//h3[@class="sri-title"]/a', row, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			//	items[next_art.href] = Zotero.Utilities.trimInternal(next_art.textContent);
			items[id] = title;

		}


		Zotero.selectItems(items, function (items) {
			if (!items) {
				Zotero.done();
				return true;
			}
			for (var i in items) {
				articles.push(i);
			}
		Zotero.Utilities.processDocuments(articles, scrape, function () { Zotero.done();});
		});


	} else {
		scrape(doc, url);
	}

}

function scrape(newDoc, url) {
	//var host = newDoc.location.host;
	var host = url.match(/http.?\:\/\/[^\/]+/)[0];
	Z.debug(host);

	var arvolink = newDoc.location.href;

	var abstractblock = ZU.xpathText(newDoc, '//section[@class="abstract"]', null, "\n\n");
	Zotero.debug(abstractblock);
	var identifierblock = ZU.xpathText(newDoc, '//div[@class="ww-citation large-view-only"]');
	Zotero.Utilities.HTTP.doGet(arvolink, function (text) {
		var id = text.match(/id=\"ResourceId\"\sname=\"ResourceId\"\stype=\"hidden\"\svalue=\"([^"]+)\"/)[1];
//		Zotero.debug(text)
//		var id = text.match(/name=\"ResourceId\"\svalue=\"([^"]+)\"/)[1];
//							/input\sid=\"ResourceIdARVO_Get_Alerts\"\sname=\"ResourceId\"\svalue=\"([^"]+)\"\stype=\"hidden\"/
		var get = host + '/Citation/Download';
		var post = 'resourceId=' + id + '&resourceType=3' + '&citationformat=0';
		var risurl = get + '?' + post;
		Z.debug(risurl);
//		Zotero.Utilities.HTTP.doPost(get, post, function (text) {
		Zotero.Utilities.HTTP.doGet(risurl, function (text) {
			text = text.replace(/JO\s\s-/g, 'JF  -');
			Z.debug(text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function (obj, item) {
				var pubName;
				if (item.journalAbbreviation) {
					pubName = item.journalAbbreviation;
				} else {
					pubName = item.publicationTitle;
				}
				if (identifierblock) {
					if (/doi:(.*)$/.test(identifierblock)) {
						item.DOI = RegExp.$1;
					}
				}
				item.abstractNote = abstractblock;
			
				var pdfpath = '//a[@id="pdfLink"]/@data-article-url';
				item.attachments = [{
					url: arvolink,
					title: pubName + " Snapshot",
					mimeType: "text/html"
				}];

				var pdflink = url.match(/(http.?:\/\/.*)\//)[1] + ZU.xpathText(newDoc, pdfpath);
				Zotero.debug('pdflink: ' + pdflink);

				if (pdflink) {

					//Zotero.Utilities.doGet(pdflink, function (text) {
					//	Zotero.debug('try to get realpdf');
					//	var realpdf = String(text.match(/"https?:.*?"/)).replace(/\"/g, "");
					//	Zotero.debug('realpdf: ' + realpdf);
					//	if (realpdf) {
					//		item.attachments.push({
					//			url: realpdf,
					//			title: pubName + ' Full Text PDF',
					//			mimeType: "application/pdf"
					//		});
					//	}
					//}, function () {
					//	item.complete();
					//});
					item.attachments.push({
						url: pdflink,
						title: pubName + ' Full Text PDF',
						mimeType: "application/pdf"
					});
					item.complete();
				} else {
					item.complete();
				}
			});
			translator.translate();
//		}, undefined, "iso-8859-1");
		});
	});
}

//Helper Functions

/**
 * Find out what kind of document this is by checking google metadata
 * @param doc The XML document describing the page
 * @param url The URL of the page being scanned
 * @param nsResolver the namespace resolver function
 * @return a string with either "multiple", "journalArticle", "conferencePaper", or "book" in it, depending on the type of document
 */

function getArticleType(doc, url, nsResolver) {
	if (url.indexOf("search.cfm") != -1) {
		Zotero.debug("Type: multiple");
		return "multiple";
	}

	var conference = ZU.xpathText(doc, '//meta[@name="citation_conference_title"]/@content');
	var journal = ZU.xpathText(doc, '//meta[@name="citation_journal_title"]/@content');
	//Zotero.debug(journal);
	if (conference && conference.indexOf(" ") != -1) return "conferencePaper";
	else if (journal) return "journalArticle";
	else return "book";

}




/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "https://iovs.arvojournals.org/Article.aspx?articleid=2523633",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Quantitative Analysis of Outer Retinal Tubulation in Age-Related Macular Degeneration From Spectral-Domain Optical Coherence Tomography and Histology",
				"creators": [
					{
						"lastName": "Litts",
						"firstName": "Katie M.",
						"creatorType": "author"
					},
					{
						"lastName": "Ach",
						"firstName": "Thomas",
						"creatorType": "author"
					},
					{
						"lastName": "Hammack",
						"firstName": "Kristen M.",
						"creatorType": "author"
					},
					{
						"lastName": "Sloan",
						"firstName": "Kenneth R.",
						"creatorType": "author"
					},
					{
						"lastName": "Zhang",
						"firstName": "Yuhua",
						"creatorType": "author"
					},
					{
						"lastName": "Freund",
						"firstName": "K. Bailey",
						"creatorType": "author"
					},
					{
						"lastName": "Curcio",
						"firstName": "Christine A.",
						"creatorType": "author"
					}
				],
				"date": "May 13, 2016",
				"DOI": "10.1167/iovs.16-19262",
				"ISSN": "1552-5783",
				"abstractNote": "Abstract  Purpose:\n     To assess outer retinal tubulation (ORT) morphology from spectral-domain optical coherence tomography (SD-OCT) volumes and donor eye histology, analyze ORT reflectivity, and estimate the number of cones surviving in ORT.   Methods:\n     In SD-OCT volumes from nine patients with advanced AMD, ORT was analyzed en face and in B-scans. The hyperreflective ORT border in cross-section was delineated and surface area calculated. Reflectivity was compared between ORT types (Closed, Open, Forming, and Branching). A flatmount retina from a donor with neovascular AMD was labeled to visualize the external limiting membrane that delimits ORT and allow measurements of cross-sectional cone area, center-to-center cone spacing, and cone density. The number of cones surviving in ORT was estimated.   Results:\n     By en face SD-OCT, ORT varies in complexity and shape. Outer retinal tubulation networks almost always contain Closed cross-sections. Spectral-domain OCT volumes containing almost exclusively Closed ORTs showed no significant direction-dependent differences in hyperreflective ORT border intensity. The surface areas of partial ORT assessed by SD-OCT volumes ranged from 0.16 to 1.76 mm2. From the flatmount retina, the average cross-sectional area of cone inner segments was 49.1 ± 7.9 μm2. The average cone spacing was 7.5 ± 0.6 μm. Outer retinal tubulation cone density was 20,351 cones/mm2. The estimated number of cones in ORT in a macula ranged from 26,399 to 186,833 cones, which is 6% to 44% of the cones present in a healthy macula.   Conclusions:\n     These first estimates for cone density and number of cones surviving in ORT suggest that ORT formation considerably distorts the photoreceptor mosaic. Results provide additional insight into the reflectivity characteristics and number of ORT cones observable in living patients by SD-OCT, as cones persist and disease progresses.",
				"issue": "6",
				"journalAbbreviation": "Invest. Ophthalmol. Vis. Sci.",
				"libraryCatalog": "ARVO journal",
				"pages": "2647-2656",
				"publicationTitle": "Investigative Ophthalmology & Visual Science",
				"url": "https://doi.org/10.1167/iovs.16-19262",
				"volume": "57",
				"attachments": [
					{
						"title": "Invest. Ophthalmol. Vis. Sci. Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Invest. Ophthalmol. Vis. Sci. Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "https://iovs.arvojournals.org/article.aspx?articleid=2535941",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Light-Induced Thickening of Photoreceptor Outer Segment Layer Detected by Ultra-High Resolution OCT Imaging",
				"creators": [
					{
						"lastName": "Li",
						"firstName": "Yichao",
						"creatorType": "author"
					},
					{
						"lastName": "Fariss",
						"firstName": "Robert N.",
						"creatorType": "author"
					},
					{
						"lastName": "Qian",
						"firstName": "Jennifer W.",
						"creatorType": "author"
					},
					{
						"lastName": "Cohen",
						"firstName": "Ethan D.",
						"creatorType": "author"
					},
					{
						"lastName": "Qian",
						"firstName": "Haohua",
						"creatorType": "author"
					}
				],
				"date": "July 13, 2016",
				"DOI": "10.1167/iovs.15-18539",
				"ISSN": "1552-5783",
				"abstractNote": "Abstract  Purpose:\n     We examined if light induces changes in the retinal structure that can be observed using optical coherence tomography (OCT).   Methods:\n     Normal C57BL/6J mice (age 3–6 months) adapted to either room light (15 minutes to ∼5 hours, 50–500 lux) or darkness (overnight) were imaged using a Bioptigen UHR-OCT system. Confocal histologic images were obtained from mice killed under light- or dark-adapted conditions.   Results:\n     The OCT image of eyes adapted to room light exhibited significant increases (6.1 ± 0.8 μm, n = 13) in total retina thickness compared to the same eyes after overnight dark adaptation. These light-adapted retinal thickness changes occurred mainly in the outer retina, with the development of a hyporeflective band between the RPE and photoreceptor-tip layers. Histologic analysis revealed a light-evoked elongation between the outer limiting membrane and Bruch's membrane from 45.8 ± 1.7 μm in the dark (n = 5) to 52.1 ± 3.7 μm (n = 5) in the light. Light-adapted retinas showed an increase of actin staining in RPE apical microvilli at the same location as the hyporeflective band observed in OCT images. Elongation of the outer retina could be detected even with brief light exposures, increasing 2.1 ± 0.3 μm after 15 minutes (n = 9), and 4.1 ± 1.0 μm after 2 hours (n = 6). Conversely, dark-adaptation caused outer retinal shortening of 1.4 ± 0.4 μm (n = 7) and 3.0 ± 0.5 μm (n = 8) after 15 minutes and 2 hours, respectively.   Conclusions:\n     Light-adaption induces an increase in the thickness of the outer retina and the appearance of a hyporeflective band in the OCT image. This is consistent with previous reports of light-induced fluid accumulation in the subretinal space.",
				"issue": "9",
				"journalAbbreviation": "Invest. Ophthalmol. Vis. Sci.",
				"libraryCatalog": "ARVO journal",
				"pages": "OCT105-OCT111",
				"publicationTitle": "Investigative Ophthalmology & Visual Science",
				"url": "https://doi.org/10.1167/iovs.15-18539",
				"volume": "57",
				"attachments": [
					{
						"title": "Invest. Ophthalmol. Vis. Sci. Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Invest. Ophthalmol. Vis. Sci. Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/
