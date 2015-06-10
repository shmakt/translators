{
	"translatorID": "a1a97ad4-493a-45f2-bd46-016069de4162",
	"label": "Optical Society of America",
	"creator": "Michael Berkowitz, Eli Osherovich, and Sebastian Karcher",
	"target": "^https?://[^.]+\\.(osapublishing|osa)\\.org",
	"minVersion": "1.0.0b4.r1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gbv",
	"lastUpdated": "2015-06-06 16:32:06"
}

/*
Optical Society of America Translator
Copyright (C) 2009-2011 CHNM and Sebastian Karcher

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
		if(doc.defaultView !== doc.defaultView.top) return;
	} catch(e) {
		return;
	};
	
	if (url.indexOf("search.cfm") != -1) {
		return "multiple";
	} else if (url.indexOf("abstract.cfm") != -1 || url.indexOf("fulltext.cfm") != -1) {
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
		scrape(doc);
	}

}

function scrape(newDoc) {
	var host = newDoc.location.host;

	var osalink = newDoc.location.href;  
	//I'm leaving this in commented out bc I'm not sure what this used to do
	//ZU.xpathText(newDoc, '//div[@id="abstract-header"]/p/a[contains(text(), "opticsinfobase")]/@href');

	var abstractblock = ZU.xpathText(newDoc, '//meta[@name="dc.description"]/@content', null, "\n\n");
	Zotero.debug(abstractblock);
	var identifierblock = ZU.xpathText(newDoc, '//meta[@name="dc.identifier"]/@content');
	Zotero.Utilities.HTTP.doGet(osalink, function (text) {
		var id = text.match(/input\s+type=\"hidden\"\s+name=\"articles\"\s+value=\"([^"]+)\"/)[1];
		var get = 'https://' + host + '/custom_tags/IB_Download_Citations.cfm';
		var post = 'articles=' + id + '&ArticleAction=export_endnote&';
		Zotero.Utilities.HTTP.doPost(get, post, function (text) {
							Z.debug(text)
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
			
				var pdfpath = '//meta[@name="citation_pdf_url"]/@content';
				item.attachments = [{
					url: osalink,
					title: pubName + " Snapshot",
					mimeType: "text/html"
				}];

				var pdflink = ZU.xpathText(newDoc, pdfpath);
				Zotero.debug('pdflink: ' + pdflink);

				if (pdflink) {

					Zotero.Utilities.doGet(pdflink, function (text) {
						Zotero.debug('try to get realpdf');
						var realpdf = String(text.match(/"https?:.*?"/)).replace(/\"/g, "");
						Zotero.debug('realpdf: ' + realpdf);
						if (realpdf) {
							item.attachments.push({
								url: realpdf,
								title: pubName + ' Full Text PDF',
								mimeType: "application/pdf"
							});
						}
					}, function () {
						item.complete();
					});
				} else {
					item.complete();
				}
			});
			translator.translate();
		}, undefined, "iso-8859-1");
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
		"url": "http://www.osapublishing.org/josaa/abstract.cfm?URI=josaa-16-1-191",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Lens axicons: systems composed of a diverging aberrated lens and a converging aberrated lens",
				"creators": [
					{
						"lastName": "Jaroszewicz",
						"firstName": "Zbigniew",
						"creatorType": "author"
					},
					{
						"lastName": "Morales",
						"firstName": "Javier",
						"creatorType": "author"
					}
				],
				"date": "January 1, 1999",
				"DOI": "10.1364/JOSAA.16.000191",
				"abstractNote": "This paper is a continuation of our previous publication on the stationary-phase-method analysis of lens axicons [J. Opt. Soc. Am. A152383 (1998)]. Systems with spherical aberration up to the fifth order are studied. Such lens axicons in their simplest versions can be made either as a setup composed of two separated third-order spherical-aberration lenses of opposite powers or as a doublet consisting of one third-order diverging element and one fifth-order converging element. The axial intensity distribution and the central core width turn out to be improved and become almost constant. The results obtained are compared with the numerical evaluation of the corresponding diffraction integral.",
				"issue": "1",
				"journalAbbreviation": "J. Opt. Soc. Am. A",
				"libraryCatalog": "Optical Society of America",
				"pages": "191-197",
				"publicationTitle": "Journal of the Optical Society of America A",
				"shortTitle": "Lens axicons",
				"url": "http://josaa.osa.org/abstract.cfm?URI=josaa-16-1-191",
				"volume": "16",
				"attachments": [
					{
						"title": "J. Opt. Soc. Am. A Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "J. Opt. Soc. Am. A Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					"Diffraction",
					"Lens system design",
					"Propagation"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.osapublishing.org/search.cfm?q=test&meta=1&full=1&cj=1&cc=0",
		"items": "multiple",
		"defer": true
	},
	{
		"type": "web",
		"url": "http://www.osapublishing.org/abstract.cfm?URI=OFC-2006-JThB89",
		"items": [
			{
				"itemType": "conferencePaper",
				"title": "Challenges in Testing Resilient Packet Ring",
				"creators": [
					{
						"lastName": "Chathnath",
						"firstName": "Praveen",
						"creatorType": "author"
					}
				],
				"date": "March 5, 2006",
				"abstractNote": "Resilient packet ring ( IEEE 802.17) is a metropolitan area network technology for data transfer based on ring configuration.The paper provides guidelines for generation of recommends simulated environments for RPR testing ,discusses ways to test complex areas of RPR( e.g Fairness),provides guidelines for generating standard compliant test suite, and puts forward a strategy for automation of RPR testing.This paper is based on development of a RPR solution based on a Network processor.RPR specifies 39 state machines which implement the functionalities Topology Discovery, Protection, Datapath, OAM, Fairness and Shapers. The specification of the functionalities as well as the interaction between them makes RPR a complex protocol to validate. Lack of RPR test generator and inter dependency of control plane on data plane adds to the challenges of RPR testing. Careful planning, execution of testing in phases, building simulators and identifying the areas of challenges will guarantee success.Table of Contents Test Suite generationSimulators for RPR testingTest Sets for RPR testingTesting of RPR areasAutomation possibilities Test Suite generation Protocol Implementation Conformance Statements (PICs) provide a guidelines but it falls short of complete testing if you want to achieve the 'carrier grade' performance of the RPR. The test suite generation demands complete knowledge of the RPR Standard (IEEE 802.17, 802.17a, 802.17b).Simulators for RPR testing Simulator testing is a crucial part of RPR validation. Two types of simulators are recommended. Control plane simulator and the dataplane simulator The control plane functionality can be tested by building a stand alone simulator which can act as a frame work to exchange packets between the control plane instances.Pipeline integration stage is the integration of different modules of the packet processing modules. Pipeline integration testing is performed in the simulated environment with all the data path components treated as one single block. The packet headers are created and injected to the Receiver block and the packets from the pipeline are captured and analyzed at the transmit block. Most of the Network Processor development workbenches (e.g. transactor of IXP) support packet generators. More than 60% of the test cases can be executed in the pipeline integration stage using packet streams generated.Test Sets for RPR testingNo single test set has features required for RPR testing .The paper compares the capabilities of various test sets including Agilent and Ixia and proposes a combination of test sets for achieving RPR test coverage.Testing of RPR areasThe paper suggests methods to validate the following areas of RPR[1] 255 node testing [2] Fairness and Shaper testing [3] 50 milliseconds protection switch time[4] Testing of strict order frames [5] Jitter measurement [6] Performance monitoring testing[7] RPR-RPR BridgingSpatially Aware Sublayer (IEEE802.17b) introduces new challenge for validation of RPR. The paper discusses the complexities involved for validation of IEEE 802.17b.Automation possibilitiesThe paper discusses the areas of automation for RPR testing and methods for the same. RPR test automation can be achieved for the pipeline integration stage, On board integration and system testing phases",
				"conferenceName": "Optical Fiber Communication Conference and Exposition and The National Fiber Optic Engineers Conference",
				"libraryCatalog": "Optical Society of America",
				"pages": "JThB89",
				"proceedingsTitle": "Optical Fiber Communication Conference and Exposition and The National Fiber Optic Engineers Conference",
				"publisher": "Optical Society of America",
				"series": "Technical Digest (CD)",
				"url": "http://www.osapublishing.org/abstract.cfm?URI=OFC-2006-JThB89",
				"attachments": [
					{
						"title": "OFC Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "OFC Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					"Other topics of general interest"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.osapublishing.org/ao/abstract.cfm?URI=ao-31-26-5706",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Optimized kinoform structures for highly efficient fan-out elements",
				"creators": [
					{
						"lastName": "Prongué",
						"firstName": "D.",
						"creatorType": "author"
					},
					{
						"lastName": "Herzig",
						"firstName": "H. P.",
						"creatorType": "author"
					},
					{
						"lastName": "Dändliker",
						"firstName": "R.",
						"creatorType": "author"
					},
					{
						"lastName": "Gale",
						"firstName": "M. T.",
						"creatorType": "author"
					}
				],
				"date": "September 10, 1992",
				"DOI": "10.1364/AO.31.005706",
				"abstractNote": "We discuss the realization of highly efficient fan-out elements. Laser-beam writing lithography is available now for fabricating smooth surface relief microstructures. We develop several methods for optimizing microstructure profiles. Only a small number of parameters in the object plane are necessary for determining the kinoform. This simplifies the calculation of M × N arrays also for large M and N. Experimental results for a 9-beam fan-out element are presented.",
				"issue": "26",
				"journalAbbreviation": "Appl. Opt.",
				"libraryCatalog": "Optical Society of America",
				"pages": "5706-5711",
				"publicationTitle": "Applied Optics",
				"url": "http://ao.osa.org/abstract.cfm?URI=ao-31-26-5706",
				"volume": "31",
				"attachments": [
					{
						"title": "Appl. Opt. Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Appl. Opt. Full Text PDF",
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
		"url": "http://www.osapublishing.org/optica/abstract.cfm?URI=optica-2-6-510",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Quantum-enhanced tomography of unitary processes",
				"creators": [
					{
						"lastName": "Zhou",
						"firstName": "Xiao-Qi",
						"creatorType": "author"
					},
					{
						"lastName": "Cable",
						"firstName": "Hugo",
						"creatorType": "author"
					},
					{
						"lastName": "Whittaker",
						"firstName": "Rebecca",
						"creatorType": "author"
					},
					{
						"lastName": "Shadbolt",
						"firstName": "Peter",
						"creatorType": "author"
					},
					{
						"lastName": "O’Brien",
						"firstName": "Jeremy L.",
						"creatorType": "author"
					},
					{
						"lastName": "Matthews",
						"firstName": "Jonathan C. F.",
						"creatorType": "author"
					}
				],
				"date": "June 20, 2015",
				"DOI": "10.1364/OPTICA.2.000510",
				"abstractNote": "A fundamental task in photonics is to characterize an unknown optical process, defined by properties such as birefringence, spectral response, thickness and flatness. Among many ways to achieve this, single-photon probes can be used in a method called quantum process tomography (QPT). However, the precision of QPT is limited by unavoidable shot noise when implemented using single-photon probes or laser light. In situations where measurement resources are limited, for example, where the process (sample) to be probed is very delicate such that the exposure to light has a detrimental effect on the sample, it becomes essential to overcome this precision limit. Here we devise a scheme for process tomography with a quantum-enhanced precision by drawing upon techniques from quantum metrology. We implement a proof-of-principle experiment to demonstrate this scheme—four-photon quantum states are used to probe an unknown arbitrary unitary process realized with an arbitrary polarization rotation. Our results show a substantial reduction of statistical fluctuations compared to traditional QPT methods—in the ideal case, one four-photon probe state yields the same amount of statistical information as twelve single probe photons.",
				"issue": "6",
				"journalAbbreviation": "Optica",
				"libraryCatalog": "Optical Society of America",
				"pages": "510-516",
				"publicationTitle": "Optica",
				"url": "http://www.osapublishing.org/optica/abstract.cfm?URI=optica-2-6-510",
				"volume": "2",
				"attachments": [
					{
						"title": "Optica Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "Optica Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [
					"Metrology",
					"Quantum information and processing"
				],
				"notes": [],
				"seeAlso": []
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.osapublishing.org/josa/abstract.cfm?uri=josa-72-1-156",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Fourier-transform method of fringe-pattern analysis for computer-based topography and interferometry",
				"creators": [
					{
						"lastName": "Takeda",
						"firstName": "Mitsuo",
						"creatorType": "author"
					},
					{
						"lastName": "Ina",
						"firstName": "Hideki",
						"creatorType": "author"
					},
					{
						"lastName": "Kobayashi",
						"firstName": "Seiji",
						"creatorType": "author"
					}
				],
				"date": "January 1, 1982",
				"DOI": "10.1364/JOSA.72.000156",
				"abstractNote": "A fast-Fourier-transform method of topography and interferometry is proposed. By computer processing of a noncontour type of fringe pattern, automatic discrimination is achieved between elevation and depression of the object or wave-front form, which has not been possible by the fringe-contour-generation techniques. The method has advantages over moire topography and conventional fringe-contour interferometry in both accuracy and sensitivity. Unlike fringe-scanning techniques, the method is easy to apply because it uses no moving components.",
				"issue": "1",
				"journalAbbreviation": "J. Opt. Soc. Am.",
				"libraryCatalog": "Optical Society of America",
				"pages": "156-160",
				"publicationTitle": "Journal of the Optical Society of America",
				"url": "http://www.osapublishing.org/abstract.cfm?URI=josa-72-1-156",
				"volume": "72",
				"attachments": [
					{
						"title": "J. Opt. Soc. Am. Snapshot",
						"mimeType": "text/html"
					},
					{
						"title": "J. Opt. Soc. Am. Full Text PDF",
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
