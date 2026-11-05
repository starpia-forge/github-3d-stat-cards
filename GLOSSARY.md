# GitHub Milky Way Stat Cards

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

**Primary Language** (주 언어):
The Language with the largest share of a repository's Language Mix.
_Avoid_: main language, top language

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
A Card shown in place of the Milky Way when none can be produced, for example for a misconfigured Subject, an organization, a Subject with no Activity, or an exhausted rate limit.
_Avoid_: error image, placeholder

### The Milky Way

**Milky Way** (은하수):
The Card that depicts a Subject's repositories as Bodies scattered along a Band of light running from their first Activity (left) to today (right).
_Avoid_: galaxy, starfield, chart

**Band** (띠):
The Milky Way's stream of light; position along it is time and its brightness is monthly Activity.
_Avoid_: axis, timeline, river

**Rift** (암흑대):
A darkened, shortened stretch of the Band where the Subject had no Activity for more than three months.
_Avoid_: gap, shallows, hiatus

**Body** (천체):
The celestial object that stands for one repository the Subject has Activity in, placed on the Band at the commit-weighted middle of that Activity.
_Avoid_: star (that is only one Tier), object, node, dot

**Tier** (단계):
The kind of Body a repository becomes, set by the Subject's commit count there: Starlight, Star, Planet or Nebula.
_Avoid_: level, rank, size

**Starlight** (별빛):
The smallest Tier: a twinkling point, for 1–9 commits, coloured by its repository's Primary Language.

**Star** (항성):
A glowing star with light spikes, for 10–49 commits, coloured by its repository's Primary Language.
_Avoid_: sun

**Planet** (행성):
A lit sphere banded by its repository's Language Mix, for 50–199 commits.

**Nebula** (성운):
A gas cloud coloured by its repository's Language Mix and stretched along the Band over its active span, for 200 or more commits.
_Avoid_: cloud, galaxy

**Other** (기타):
The neutral colour group that stands for every Language outside the Subject's top six.
_Avoid_: misc, rest, tail
