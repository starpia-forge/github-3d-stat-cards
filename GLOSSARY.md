# GitHub 3D Stat Cards

Embeddable images for GitHub profile READMEs that depict, in 3D, how a GitHub user has worked over time. Each person deploys their own copy to get their own Card.

## Language

### People

**Subject** (대상):
The GitHub user account a Card depicts. Each Instance depicts exactly one Subject, normally its Host. Organizations are never Subjects.
_Avoid_: user, owner, account

**Host** (호스트):
The person who forks, configures and deploys an Instance and supplies its GitHub token; normally the Subject themself.
_Avoid_: deployer, admin, owner

**Visitor** (방문자):
A person looking at a Card, usually on the Subject's profile page.
_Avoid_: viewer (the GitHub API's `viewer` is the Host's token owner), user, reader

### Instances

**Instance** (인스턴스):
One deployment of the project, operated by one Host and depicting one Subject.
_Avoid_: server, site, app, public instance

### Activity

**Activity** (활동):
The Subject's commits, counted the way GitHub counts commit contributions, aggregated per Period.
_Avoid_: contributions, work, usage

**Period** (기간):
A calendar month, the unit over which Activity is aggregated.
_Avoid_: bucket, window, era

**Private Activity** (비공개 활동):
Activity in repositories that are not publicly visible.
_Avoid_: hidden activity, restricted contributions

**Language** (언어):
A language as GitHub counts it in a repository's language statistics.
_Avoid_: technology, stack, skill

**Language Mix** (언어 구성):
The share of each Language in a repository's code as it stands today.
_Avoid_: language breakdown, composition

**Attribution** (배분):
Splitting a repository's Activity across Languages in proportion to its Language Mix.
_Avoid_: classification, detection

**Language History** (언어 기록):
A Subject's Activity broken down by Language and Period.
_Avoid_: top languages, language stats

### Output

**Card** (카드):
An embeddable image showing one visualization of one Subject.
_Avoid_: badge, widget, banner

**Fallback Card** (대체 카드):
A Card shown in place of a Language History when none can be produced, for example for a misconfigured Subject, an organization, a Subject with no Activity, or an exhausted rate limit.
_Avoid_: error image, placeholder

### The River

**River** (강):
The Card that depicts a Subject's Language History as a river flowing from their first Activity (left) to today (right).
_Avoid_: chart, graph, streamgraph

**Stream** (물줄기):
The part of the River that carries one Language; its width at any point is that Language's Activity at that time.
_Avoid_: current (reads as "present"), band, layer, channel

**Other Stream** (기타 물줄기):
The single Stream that carries every Language outside the Subject's top six.
_Avoid_: misc, rest, tail

**Tributary** (지류):
The point where a Stream first joins the River: the Subject taking up a Language.
_Avoid_: branch, fork (both mean something else on GitHub)

**Distributary** (갈래):
The point where a Stream leaves the River: the Subject putting a Language down.
_Avoid_: branch, fork

**Shallows** (여울):
A stretch of the River where the Subject had little or no Activity.
_Avoid_: gap, drought, hiatus

**Cut Face** (단면):
The River's right-hand end, cut at today, showing the Subject's Language composition over the last twelve months.
_Avoid_: legend, summary

**Diorama** (디오라마):
The long block of land the River runs across.
_Avoid_: terrain, map, background
