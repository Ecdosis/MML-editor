### Minimal Markup Languages
#### About MMLs

MMLs are based on [Markdown](http://daringfireball.net/projects/markdown/syntax). They are designed to represent historical printed and handwritten documents, to capture their features. Hence MMLs do not support word-processor features of MarkDown like inline HTML, lists, atx-style headings or links to external documents, although they do support references to images. But MMLs have features that are not found in MarkDown, such as smartquotes, dividers, soft-hyphens, poetry indenting and milestones. 

Each MML is custom-built for a specific need. This is so that only those tags needed for a specific project are defined and used, and for these only minimal names need be defined. They are usually single characters, but may be longer. Although each encoding scheme is 'non-standard', this does not matter, since the MML encoding is not stored. Rather its conversion into HTML, or a derivation of it is, and the MML representation is regenerated on demand only to facilitate editing.

#### Editor
The MML Editor is a javascript object that will eventually consist of three panels. The three panels are syncro-scrollable. That is, scrolling any one automatically scrolls the others to the corresponding positions.

1. The leftmost panel is a scrollable series of page-images. 
2. The second panel contains the editable MML text in a simple textarea. 
3. The third contains a HTML preview of the MML text. 

To create the MML-Editor all that is needed is a JSON dialect file and three elements with IDs on a HTML page: two divs (for panels 1 and 3) and a textarea. Also needed is a css file to format the preview. Invocation is like this:

    var editor = new MMLEditor("source","target", opts);

The first and second (and eventually third) arguments are IDs of the elements the panels will replace. The current third argument is a string representation of the dialect file. 

The CMS should provide buttons to perform the basic operations of the editor, but the editor itself only has an API to perform these functions:

1. Save. This sends the HTML representation to the server. The service will may then strip all tags and properties from the text and represent the two separately. Alternatively it may simply store the HTML.
2. Info. This displays the dialect file by reformatting it as HTML, and laying the result on top of the second panel. Clicking again on Info removes it.
3. Version. This dropdown menu selects the version of the document for display. Historical documents are divided into layers for internal versions and external versions arising from separate physical documents. In the latter case changing a version will load a different set of page-images.
4. New Layer or version. Clicking this button will create a form to replace the central panel. The form will allow the specification of basic metadata about the new layer or version. Initially the layer will be a copy of another layer. Clicking the submit button on the form will close the form and replace it with the MML text again.
5. Delete layer or version. This will completely remove a layer or version from the document.

Since the editor is only invoked to edit a particular document or work it does not need an "open" button. The user will already have clicked "Edit" on some document, and need only go back or select another feature of the website from the normal CMS menu above.

#### MML Dialect file
The MML dialect file describes all the configurable parts of an MML definition.

Only two features are hard-wired into MML. These are:

1. Paragraphs are divided by two newlines ("\n\n")
2. Sections are divided by three newlines ("\n\n\n")

Three further features are hard-wired but can be turned off:

1. Quotations are marked by leading "> " at the start of lines, the first of which must start a paragraph. They may nest.
2. Code sections or preformatted blocks begin with four spaces. Subsequent spaces are preserved.
3. 3. Soft-hyphens."-\n" (hyphen at line-end) is converted into a span whose class name is "soft-hyphen".

Everything else is configurable. The MML description file may be an empty string, in which case only the paragraphs and sections will be recognised, and no properties will be added to them.

Individual features can also be omitted and will not be processed. For example, omitting "codeblocks" will disable all codeblocks. 

An example MML definition is:

    {
        "description": "Novel markup for De Roberto",
        "section": {"prop": "section"},
        "paragraph": {"prop": ""},
        "codeblocks": {"prop": ""},
        "quotations": {"prop": ""},
        "smartquotes": true,
        "softhyphens": true,
        "headings": [{"tag":"=","prop":"h1"},{"tag":"-","prop":"h2"},{"tag":"_","prop":"h3"}],
        "dividers": [{"tag":"-----","prop":"dash"}, {"tag":"--+--","prop":"plus"}],
        "charformats": [{"tag":"*","prop":"italics"},{"tag":"`","prop":"letter-spacing"}],
        "paraformats": [{"leftTag":"->","rightTag":"<-","prop":"centered"}],
        "milestones": [{"leftTag":"[","rightTag":"]","prop":"page"}]
    }

Several keywords are used in an MML definition. 

1. prop - this keyword designates the name of the property marked up by the tag to which it is bound. For example, specifying a charformat "italics" with the tag "*" means that HTML spans will be created with the class and title value "italics". When saved, the property value is the only stored attribute of that text-span.
2. tag - the character string (usually just one character) which is used to define the property in MML. It may be a repeatable code like *italics* or something like a setext underlining
3. leftTag - used instead of tag when distinct left and right tags are needed.
4. righttag the right hand version of the tag in the text

### Keywords
#### description
This can be omitted as it is not processed. It provides a short description which will be formatted into HTML for display when the user selects the info button for this dialect.

#### section
This keyword designates a JSON object whose only attribute is "prop", the name of the section type.

#### paragraph
This contains a single JSON object whose only value may be "prop", which designates the class of all default paragraphs. If the property name is empty or missing no property will be used.

#### codeblocks
This contains a single JSON object whose only attribute is "prop", which specifies the class name of all code blocks. If it is omitted or empty no class name will be used.

#### smartquotes
This keyword takes a bare boolean value. If true single and double-quotes will be converted into curly quotes in UniCode. If false they will be left alone. Already curly quotes will be left unchanged.

#### softhyphens
This keyword also takes a bare boolean value. If true, hyphens at the ends of lines will be replaced by &lt;span class="soft-hyphen"&gt;-&lt;/span&gt;. When hyphens marked with the property "soft-hyphen" are submitted to the server, it checks whether they really are soft (whether the two halves are not words in the relevant dictionary or are in the hard hyphens exceptions list). If they fail both of these tests the property is changed to "hard-hyphen" when it is returned for updating.

#### headings
This keyword designates an array of tag defintions. Each definition may contain two attributes: "tag" which gives the single character used as a setext underlining to designate headings, and "prop" which is the class of the HTML element that will be created. The name of the HTML element depends on the order. The first heading will be H1, the second H2 up to H6.

#### dividers
Dividers are separators, usually in the form of a long dash or series of stars. They must be a paragraph on their own (separated by 2 preceding and following newlines). This keyword expects an array of JSON objects, each with the standard tag and prop attributes. In this case the "tag" attribute designates the entire text of the divider, which must match exactly in the source if it is to be recognised. The prop attribute is used to link to CSS properties which effectively create the divider. All dividers are the same: they consist of a 2x2 &lt;table&gt;, whose class will be value of prop, and the four cells (&lt;td&gt;) have class names &lt;propname&gt;-topleft, -topright, -botleft, -botright.

#### charformats
This keyword expects an array of JSON objects, each of which has the standard tag and prop attributes. The tag attibute designates a string, which is usually one character long, and which is repeated at the start and end of the charformatted  text. Each charformat generates one &lt;span&gt;-element with the enclosed text inside, and the class value of the prop attribute. charformats are dropped at line end.

#### paraformats
This keyword expects an array of JSON objects, which have the standard leftTag, rightTag and prop attributes. LeftTags are recognised only at paragraph start and rightTags only at paragraph end, although they may be preceded or followed by white space (tabs and spaces). Paraformats generate &lt;p&gt; elements in HTML with the prop as the class name.

#### milestones
Milestones mark positions in the text where some counter changes value, such as a page break. They designate the value of that property until the next such break. They are rendered as spans with the class of the "prop" attribute. This keyword expects an array of JSON objects, each of which has the standard leftTag, rightTag and prop attributes. Milestones are usually formatted with the css property display: none.

