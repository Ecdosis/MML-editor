MMLs (minimal markup languages) are designed to reduce the markup 
required to encode historical documents to the absolute minimum. That 
means: no tags are allowed that do not contribute to the encoding, and 
secondly that these codes are the shortest possible. MMLs are inspired 
by MarkDown, but they omit things in MarkDown that are not needed in 
historical documents, such as automatic numbering of lists, links to 
other HTML pages (how many printed or manuscript books have those?), 
inline HTML etc. But they also add several features not found in 
MarkDown, such as smart-quotes, automatic joining up of hyphenated 
words, poetry indentation, page-numering, etc. The MML editor here was 
originally designed for the De Roberto editon (a novel) but has been 
generalised via a JSON "dialect" file, which speciies which tags are 
defined. These are usually just single characters, like \*italic\* for 
italics. But not only what they are but also what they signify is 
configurable. Each "tag" is given a property, and it is these properties 
that get encoded into the HTML preview as class attributes. When the 
user saves the text the properties, NOT the MML, are sent to the server. 
When re-editing the document the MML expression is regenerated using the 
dialect file. In this way the customisability of the user interface is 
preserved while achieving a high degree of simplicity and 
interoperability.

To use it load mml-editor.html into any browser. You need an Internet 
connection for the jQuery for it to work. Eventually this whole editor 
will become a jQuery plugin.
