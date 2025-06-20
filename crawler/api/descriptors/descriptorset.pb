
�	
crawlerapi/crawler.proto
crawlerapi"8
CrawlCookpadRecipeRequest
	recipe_id (	RrecipeId"
CrawlCookpadRecipeResponse"2
CrawlCookpadUserRequest
user_id (	RuserId"
CrawlCookpadUserResponse2�
CrawlerService]
CrawlCookpadUser#.crawlerapi.CrawlCookpadUserRequest$.crawlerapi.CrawlCookpadUserResponsec
CrawlCookpadRecipe%.crawlerapi.CrawlCookpadRecipeRequest&.crawlerapi.CrawlCookpadRecipeResponseB;Z9github.com/curioswitch/cookchat/crawler/api/go;crawlerapiJ�
  

  

 

 P
	
 P


  	


 !
5
  ( The ID of the cookpad recipe to crawl.


  

  	

  
	
 %


"
<
 0 A request for CrawlerService.CrawlCookpadUser.




8
 + The user ID of the cookpad user to crawl.


 

 	

 
=
 #2 A response from CrawlerService.CrawlCookpadUser.



 
-
  ! A service for crawling recipes.



 
C
  S6 Crawl a cookpad user, crawling all of their recipes.


  

  .

  9Q
&
 Y Crawl a cookpad recipe.


 

 2

 =Wbproto3