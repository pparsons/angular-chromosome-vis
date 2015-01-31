#angular-chromosome-vis

chromosome visual representation for angular 

##How to use
Include the angular-chromosome-vis dependency on your angular module:

```html
var app = angular.module("myApp", ["angular-chromosome-vis"]);
```

Include the script and stylesheet in your HTML, e.g.:

```html
<script src="bower_components/angular/angular.min.js"></script>
<script src="bower_components/d3/d3.min.js"></script>
<script src="bower_components/jsdas/jsdas.min.js"></script>
<script src="bower_components/angular-chromosome-vis/angular-chromosome-vis.js"></script>
<link rel="stylesheet" href="bower_components/angular-chromosome-vis.css" />
```

Add the directive to your HTML, e.g.:

```html
<div chromosome chr="1" rel-size="true" axis="true" assembly="37" width='850' height="20" mode="multi"></div>
```