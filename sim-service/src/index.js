
let myResolver = null

/* This Resolver class adds the "example" resolver for Ticketmaster and
** Axs for password and emailcode fields for profiles.
*/
class Resolver {

  constructor(jancy) {
    this.jancy = jancy
    this.name = 'simservicev1'
  }

  /* Resolves the current value for a field.
  **
  ** Arguments:
  **    args (object)
  **      field (string) -- the field to resolve (password, smscode, or emailcode)
  **      site (string) -- "ticketmaster", "axs", or "other"
  **      profile (object) -- the profile to resolve against. it contains the following fields.
  **        profileName (string)
  **        name (string)
  **        address (string)
  **        address2 (string)
  **        city (string)
  **        state (string)
  **        zip (string)
  **        email (string)
  **        phoneNumber (string)
  **        smsNumber (string)
  **        passcode (string)
  **      url (string) -- URL if args.site === "other"
  **      resolverArgs (Array<string>) -- array of arguments parsed from the profile
  **                                      file. See below for an example...
  **
  ** If the resolver is defined as "password=example:MY-API-TOKEN" in the profile file then resolverArgs[0] === "MY-API-TOKEN"
  ** Returns a promise that resolves with an object or null if couldn't be resolved. The object needs
  ** to have the following fields:
  **
  **    {
  **      value (string) -- the resolved value or w/e you want to display
  **      timestamp (string) -- a string representing a time (something that can be parsed by Date.parse)
  **                            when the value was last updated can be null
  **    }
  */
  resolveValue(args) {
    return new Promise(async (resolve, reject) => {

      let parserKey = null;
      let obj = null;

      if(args.site === 'ticketmaster'){
        parserKey = 'ticketmaster'
      }
      
      if (args.resolverArgs.length === 3) {
        parserKey = args.resolverArgs[2]
      }
      
      // Retrieve the parser interface and the specific parser based on the key
      const iface = this.jancy.getInterface('parserRegistry');
      const parser = iface.getParser('sms', parserKey);
  
      if (!parser) {
        // If no parser is found for the key, set the error state
        obj = { value: '#NO PARSER', timestamp: null, isError: true };
        this.jancy.console.log(`Could not find an sms parser for ${parserKey}`);
      } else if (args.resolverArgs) {
        // Construct the URL for fetching the SMS message
        const url = `https://sms-4kqy.onrender.com/messages?phone_number=${args.profile.free1}`;
        this.jancy.console.log(url)
        
        
        try {
          // Make the GET request to fetch the SMS messages
          // AXIOS returns this: https://axios-http.com/docs/res_schema
          const response = await this.jancy.axios.get(url, {
            headers: { 'X-API-Key': args.resolverArgs[0],
                       'X-USER-KEY': args.resolverArgs[1]
             },
          });
          if (response.status === 200) {
            const messages = response.data.messages;
            for(let mdx=0; mdx<response.data.messages.length; ++mdx) {
              const message = messages[mdx]
              const code = parser.parseMessage(jancy, args, message.Message)
              if (code) {
                obj = { value: code, timestamp: message.Timestamp, isError: false }
                break
              }
            }
            if (!obj) {
              // If no messages match the parser used #NO MSG gets printed to the field 
              obj = { value: '#NO MSG', timestamp: null, isError: true };
            }
          }
  
        } catch (error) {
          obj = { value: '#API ERROR', timestamp: null, isError: true }
          this.jancy.console.log(`sim-service: api returned ${ response.status }`)
        }
      } else {
        obj = { value: '#NO SMS NUMBER', timestamp: null, isError: true };
      }
  
      resolve(obj);
    });
  }
}  
  

module.exports = {
  
  /* jancy_props is an object used to communicate some useful infromation about
  ** your plugin to the Jancy plugin registry.
  **
  ** Required props:
  **    registryVersion (number) - tells Jancy what version of the plugin registry
  **                               this plugin was built against. Currently version
  **                               1 is supported.
  **
  ** Optional props:
  **    enabled (boolean) - if false, tells Jancy to not enable your plugin by
  **                        default the first time it loads. Default is true.
  **
  */
  jancy_props: {
    registryVersion: 1
  },

  /* --------------------------------------------------------------------------
  ** jancy_onInit is called by the plugin registry when the plugin is loaded.
  **
  ** This is your first opportunity to iteract with Jancy.
  **
  ** Arguments:
  **    jancy (Object)
  **    enabled (boolean) -- is our plugin enabled
  ** ------------------------------------------------------------------------*/
  jancy_onInit(jancy, enabled) {
    myResolver = new Resolver(jancy)
    if (enabled) {
      this.jancy_onEnabled(jancy)
    }
  },

  /* --------------------------------------------------------------------------
  ** Called by the pluginRegistry when the user has enabled us and we
  ** were previously disabled.
  **
  ** This is a good opportunity to add things to Jancy that your plugin
  ** provides.
  **
  ** Arguments:
  **    jancy (object)
  ** ------------------------------------------------------------------------*/
  jancy_onEnabled(jancy) {

    /* Resolvers are special objects that provide the glue between Jancy and 3rd
    ** party APIs that can return information like site specific passwords, 2FA
    ** codes, etc.
    **
    ** Resolvers are registered with Jancy by calling the addResolver method on
    ** the profileRegistry object attached to the Jancy object.
    */
    jancy.profileRegistry.addResolver(myResolver)
  },

  /* --------------------------------------------------------------------------
  ** Called by the pluginRegistry when the user has disabled us and
  ** we were previously enabled.
  **
  ** This is a good opportunity to remove things from Jancy that your plugin
  ** added.
  **
  ** Arguments:
  **    jancy (object)
  ** ------------------------------------------------------------------------*/
  jancy_onDisabled(jancy)  {
    /* Remove our resolver when the plugin is disabled.
    */
    jancy.profileRegistry.removeResolver(myResolver)
  }
}
