import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'

export enum SettingKey {
  SiteTitle = 'site_title',
  SiteName = 'site_name',
  SiteDescription = 'site_description',
  SiteKeywords = 'site_keywords',
  SiteLogo = 'site_logo',
  SiteFavicon = 'site_favicon',
  SiteUrl = 'site_url',
  SiteFooter = 'site_footer',

  AiPilotUrl = 'ai_pilot_url',
  LafForumUrl = 'laf_forum_url',
  LafBusinessUrl = 'laf_business_url',
  LafDiscordUrl = 'laf_discord_url',
  LafWeChatUrl = 'laf_wechat_url',
  LafAboutUsUrl = 'laf_about_us_url',
  LafDocUrl = 'laf_doc_url',

  AppCreateTimeOut = 'app_create_timeout',
}

export class Setting {
  @ApiProperty({ type: String })
  _id?: ObjectId

  @ApiProperty()
  public: boolean

  @ApiProperty({ type: String, enum: SettingKey })
  key: SettingKey | string

  @ApiProperty()
  value: string

  @ApiPropertyOptional()
  desc?: string

  @ApiPropertyOptional()
  metadata?: any
}
