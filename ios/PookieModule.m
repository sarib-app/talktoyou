#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PookieModule, NSObject)
RCT_EXTERN_METHOD(saveMessage:(NSString *)text fromName:(NSString *)fromName sentAt:(double)sentAt)
@end
